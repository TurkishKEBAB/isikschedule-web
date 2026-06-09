# pyright: strict
"""Exact schedule search with bitmasks, MRV ordering, and forward checking."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from itertools import islice, product
from math import inf, prod
from time import perf_counter
from typing import Literal, NotRequired, TypeAlias, TypedDict, cast

MAX_DISCOVERED_LAYOUTS = 100
MAX_RETURNED_SCHEDULES = 20
MAX_VARIANTS_PER_LAYOUT = 5
QUALITY_WEIGHT = 0.65
DIVERSITY_WEIGHT = 0.35

TimeSlot: TypeAlias = tuple[str, int]
RawTimeSlot: TypeAlias = TimeSlot | list[str | int]
ScheduleData: TypeAlias = list[RawTimeSlot]
LayoutComponent: TypeAlias = tuple[str, str, tuple[TimeSlot, ...]]
LayoutSignature: TypeAlias = tuple[LayoutComponent, ...]
VariantSignature: TypeAlias = tuple[str, ...]

_DAY_ORDER = {
    "Monday": 0,
    "Tuesday": 1,
    "Wednesday": 2,
    "Thursday": 3,
    "Friday": 4,
    "Saturday": 5,
    "Sunday": 6,
}


class CourseData(TypedDict):
    code: str
    main_code: str
    name: str
    ects: int | float
    type: str
    schedule: ScheduleData
    schedule_str: NotRequired[str]
    teacher: NotRequired[str | None]
    faculty: NotRequired[str]
    department: NotRequired[str]
    campus: NotRequired[str]
    prerequisites: NotRequired[list[str]]
    corequisites: NotRequired[list[str]]


CourseOption: TypeAlias = list[CourseData]


class CourseComponents(TypedDict):
    lecture: list[CourseData]
    lab: list[CourseData]
    ps: list[CourseData]


class RequiredComponents(TypedDict):
    lab: bool
    ps: bool


class GeneratedSchedule(TypedDict):
    id: str
    score: int | float
    total_ects: int | float
    conflict_count: int
    course_count: int
    courses: CourseOption
    variant_count: int
    variants: list[CourseOption]


DiagnosisCode = Literal[
    "missing_course",
    "missing_required_component",
    "locked_blocks_course",
    "ects_exceeded",
    "conflict_limit_exceeded",
]


class DiagnosisReason(TypedDict):
    code: DiagnosisCode
    data: dict[str, object]


class Diagnosis(TypedDict):
    status: Literal["ok", "empty"]
    result_count: int
    reasons: list[DiagnosisReason]


class SearchMetadata(TypedDict):
    algorithm: str
    selection_strategy: str
    search_complete: bool
    elapsed_ms: float
    explored_nodes: int
    pruned_by_conflict: int
    pruned_by_ects: int
    pruned_by_forward_check: int
    discovered_layouts: int
    candidate_pool_size: int


class GenerationResult(TypedDict):
    schedules: list[GeneratedSchedule]
    diagnosis: Diagnosis
    metadata: SearchMetadata


def _new_variant_signature_set() -> set[VariantSignature]:
    return set()


@dataclass(slots=True)
class LayoutChoice:
    main_code: str
    variants: list[CourseOption]
    variant_signatures: set[VariantSignature] = field(
        default_factory=_new_variant_signature_set
    )
    slot_mask: int = 0
    internal_conflicts: int = 0
    total_ects: float = 0.0


@dataclass(slots=True)
class CourseDomain:
    main_code: str
    choices: list[LayoutChoice]
    degree: int = 0
    min_ects: float = 0.0


@dataclass(slots=True)
class SearchCounters:
    explored_nodes: int = 0
    pruned_by_conflict: int = 0
    pruned_by_ects: int = 0
    pruned_by_forward_check: int = 0
    search_complete: bool = True


@dataclass(frozen=True, slots=True)
class DiversityFeatures:
    components: frozenset[LayoutComponent]
    occupied_slots: frozenset[TimeSlot]
    free_days: int
    total_gaps: int
    earliest_period: int
    latest_period: int


def slot_list(raw_slots: object) -> list[TimeSlot]:
    """Normalize JSON/list time slots while preserving duplicate meetings."""
    normalized: list[TimeSlot] = []
    if not isinstance(raw_slots, (list, tuple, set)):
        return normalized

    slots = cast(list[object] | tuple[object, ...] | set[object], raw_slots)
    for slot in slots:
        if not isinstance(slot, (list, tuple)):
            continue
        parts = cast(list[object] | tuple[object, ...], slot)
        if len(parts) < 2:
            continue
        day = str(parts[0]).strip()
        period_value = parts[1]
        if not isinstance(period_value, (str, bytes, bytearray, int, float)):
            continue
        try:
            period = int(period_value)
        except (TypeError, ValueError):
            continue
        if day:
            normalized.append((day, period))
    return normalized


def normalize_slots(raw_slots: object) -> set[TimeSlot]:
    """Return unique normalized time slots."""
    return set(slot_list(raw_slots))


def count_conflicts(courses: list[CourseData]) -> int:
    """Count duplicate occupied slots using the existing API semantics."""
    occupied: set[TimeSlot] = set()
    conflicts = 0
    for course in courses:
        for slot in slot_list(course.get("schedule", [])):
            if slot in occupied:
                conflicts += 1
            else:
                occupied.add(slot)
    return conflicts


def course_ects(course: CourseData) -> float:
    value = course.get("ects", 0)
    if isinstance(value, bool):
        return float(int(value))
    return float(value)


def get_int_param(params: dict[str, object], key: str, default: int) -> int:
    value = params.get(key, default)
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (str, bytes, bytearray, int, float)):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default
    return default


def layout_signature(courses: list[CourseData]) -> LayoutSignature:
    components: list[LayoutComponent] = []
    for course in courses:
        components.append(
            (
                str(course.get("main_code", "")).upper(),
                str(course.get("type", "lecture")).lower(),
                tuple(sorted(normalize_slots(course.get("schedule", [])), key=_slot_sort_key)),
            )
        )
    return tuple(sorted(components))


def variant_signature(courses: list[CourseData]) -> VariantSignature:
    serialized = (
        json.dumps(
            course,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=True,
            default=str,
        )
        for course in courses
    )
    return tuple(sorted(serialized))


def _slot_sort_key(slot: TimeSlot) -> tuple[int, str, int]:
    day, period = slot
    return (_DAY_ORDER.get(day, len(_DAY_ORDER)), day, period)


def _empty_components() -> CourseComponents:
    return {"lecture": [], "lab": [], "ps": []}


def _build_course_options(
    components: CourseComponents,
    required: RequiredComponents,
) -> list[CourseOption]:
    lectures = components["lecture"]
    labs = components["lab"]
    ps_sections = components["ps"]

    if not lectures:
        return []
    if required["lab"] and not labs:
        return []
    if required["ps"] and not ps_sections:
        return []

    options: list[CourseOption] = []
    for lecture in lectures:
        if not required["lab"] and not required["ps"]:
            options.append([lecture])
        elif required["lab"] and not required["ps"]:
            options.extend([lecture, lab] for lab in labs)
        elif required["ps"] and not required["lab"]:
            options.extend([lecture, ps] for ps in ps_sections)
        else:
            options.extend([lecture, lab, ps] for lab in labs for ps in ps_sections)
    return options


def _group_course_options(main_code: str, options: list[CourseOption]) -> list[LayoutChoice]:
    groups: dict[LayoutSignature, LayoutChoice] = {}
    for option in options:
        signature = layout_signature(option)
        exact_variant = variant_signature(option)
        group = groups.get(signature)
        if group is None:
            group = LayoutChoice(main_code=main_code, variants=[])
            groups[signature] = group
        if exact_variant in group.variant_signatures:
            continue
        group.variant_signatures.add(exact_variant)
        group.variants.append(option)
    return list(groups.values())


def _compile_choice(choice: LayoutChoice, slot_to_bit: dict[TimeSlot, int]) -> None:
    representative = choice.variants[0]
    meetings: list[TimeSlot] = []
    for course in representative:
        meetings.extend(slot_list(course.get("schedule", [])))

    unique_slots = set(meetings)
    mask = 0
    for slot in unique_slots:
        mask |= 1 << slot_to_bit[slot]

    choice.slot_mask = mask
    choice.internal_conflicts = len(meetings) - len(unique_slots)
    choice.total_ects = sum(course_ects(course) for course in representative)


def _build_domains(
    all_courses: list[CourseData],
    selected_main_codes: list[str],
    locked_slots: set[TimeSlot],
) -> tuple[list[CourseDomain], list[DiagnosisReason]]:
    selected = list(dict.fromkeys(code.upper() for code in selected_main_codes))
    source_groups: dict[str, CourseComponents] = {
        code: _empty_components() for code in selected
    }
    unlocked_groups: dict[str, CourseComponents] = {
        code: _empty_components() for code in selected
    }

    for course in all_courses:
        main_code = str(course.get("main_code", "")).upper()
        if main_code not in source_groups:
            continue
        course_type = str(course.get("type", "lecture")).lower()
        if course_type not in {"lecture", "lab", "ps"}:
            continue

        source = source_groups[main_code]
        unlocked = unlocked_groups[main_code]
        if course_type == "lecture":
            source["lecture"].append(course)
            if not (normalize_slots(course.get("schedule", [])) & locked_slots):
                unlocked["lecture"].append(course)
        elif course_type == "lab":
            source["lab"].append(course)
            if not (normalize_slots(course.get("schedule", [])) & locked_slots):
                unlocked["lab"].append(course)
        else:
            source["ps"].append(course)
            if not (normalize_slots(course.get("schedule", [])) & locked_slots):
                unlocked["ps"].append(course)

    reasons: list[DiagnosisReason] = []
    grouped_choices: list[tuple[str, list[LayoutChoice]]] = []

    for main_code in selected:
        source = source_groups[main_code]
        if not source["lecture"] and not source["lab"] and not source["ps"]:
            reasons.append(
                {"code": "missing_course", "data": {"course": main_code}}
            )
            continue

        required = RequiredComponents(
            lab=bool(source["lab"]),
            ps=bool(source["ps"]),
        )
        if not source["lecture"]:
            reasons.append(
                {
                    "code": "missing_required_component",
                    "data": {"course": main_code, "type": "lecture"},
                }
            )
            continue

        source_options = _build_course_options(source, required)
        if not source_options:
            missing_type = "lab" if required["lab"] and not source["lab"] else "ps"
            reasons.append(
                {
                    "code": "missing_required_component",
                    "data": {"course": main_code, "type": missing_type},
                }
            )
            continue

        unlocked_options = _build_course_options(unlocked_groups[main_code], required)
        if not unlocked_options:
            reasons.append(
                {"code": "locked_blocks_course", "data": {"course": main_code}}
            )
            continue

        grouped_choices.append(
            (main_code, _group_course_options(main_code, unlocked_options))
        )

    if reasons:
        return [], reasons

    all_slots: set[TimeSlot] = set()
    for _, choices in grouped_choices:
        for choice in choices:
            representative = choice.variants[0]
            for course in representative:
                all_slots.update(normalize_slots(course.get("schedule", [])))

    slot_to_bit = {
        slot: index
        for index, slot in enumerate(sorted(all_slots, key=_slot_sort_key))
    }

    domains: list[CourseDomain] = []
    for main_code, choices in grouped_choices:
        for choice in choices:
            _compile_choice(choice, slot_to_bit)
        domains.append(
            CourseDomain(
                main_code=main_code,
                choices=choices,
                min_ects=min(choice.total_ects for choice in choices),
            )
        )

    for left_index, left in enumerate(domains):
        for right in domains[left_index + 1 :]:
            if any(
                left_choice.slot_mask & right_choice.slot_mask
                for left_choice in left.choices
                for right_choice in right.choices
            ):
                left.degree += 1
                right.degree += 1

    return domains, []


def _conflict_delta(occupied_mask: int, choice: LayoutChoice) -> int:
    return choice.internal_conflicts + (occupied_mask & choice.slot_mask).bit_count()


def _candidate_choices(
    domain: CourseDomain,
    remaining: list[int],
    domains: list[CourseDomain],
    occupied_mask: int,
    current_conflicts: int,
    current_ects: float,
    max_conflicts: int,
    max_ects: int,
    counters: SearchCounters,
) -> list[LayoutChoice]:
    minimum_other_ects = sum(
        domains[index].min_ects for index in remaining if domains[index] is not domain
    )
    candidates: list[LayoutChoice] = []
    for choice in domain.choices:
        delta = _conflict_delta(occupied_mask, choice)
        if current_conflicts + delta > max_conflicts:
            counters.pruned_by_conflict += 1
            continue
        if current_ects + choice.total_ects + minimum_other_ects > max_ects:
            counters.pruned_by_ects += 1
            continue
        candidates.append(choice)

    candidates.sort(
        key=lambda choice: (
            _conflict_delta(occupied_mask, choice),
            -choice.total_ects,
            choice.slot_mask,
        )
    )
    return candidates


def _select_mrv_domain(
    remaining: list[int],
    domains: list[CourseDomain],
    occupied_mask: int,
    current_conflicts: int,
    current_ects: float,
    max_conflicts: int,
    max_ects: int,
    counters: SearchCounters,
) -> tuple[int, list[LayoutChoice]]:
    best_index = remaining[0]
    best_candidates: list[LayoutChoice] | None = None
    best_key: tuple[int, int, str] | None = None

    for index in remaining:
        domain = domains[index]
        candidates = _candidate_choices(
            domain,
            remaining,
            domains,
            occupied_mask,
            current_conflicts,
            current_ects,
            max_conflicts,
            max_ects,
            counters,
        )
        key = (len(candidates), -domain.degree, domain.main_code)
        if best_key is None or key < best_key:
            best_index = index
            best_candidates = candidates
            best_key = key
        if not candidates:
            break

    return best_index, best_candidates or []


def _forward_check(
    remaining: list[int],
    domains: list[CourseDomain],
    occupied_mask: int,
    current_conflicts: int,
    current_ects: float,
    max_conflicts: int,
    max_ects: int,
) -> bool:
    total_minimum = sum(domains[index].min_ects for index in remaining)
    for index in remaining:
        domain = domains[index]
        minimum_other = total_minimum - domain.min_ects
        if not any(
            current_conflicts + _conflict_delta(occupied_mask, choice)
            <= max_conflicts
            and current_ects + choice.total_ects + minimum_other <= max_ects
            for choice in domain.choices
        ):
            return False
    return True


def _materialize_schedule(
    domains: list[CourseDomain],
    selections: dict[int, LayoutChoice],
    conflict_count: int,
) -> GeneratedSchedule:
    ordered_choices = [selections[index] for index in range(len(domains))]
    variant_lists = [choice.variants for choice in ordered_choices]
    variants: list[CourseOption] = []
    for variant_combination in islice(
        product(*variant_lists),
        MAX_VARIANTS_PER_LAYOUT,
    ):
        courses: CourseOption = []
        for course_set in variant_combination:
            courses.extend(course_set)
        variants.append(courses)

    variant_count = prod(len(variant_list) for variant_list in variant_lists)
    courses = variants[0]
    total_ects = sum(choice.total_ects for choice in ordered_choices)
    score = (10 - conflict_count) * 50 + len(domains) * 20 + total_ects

    return {
        "id": "",
        "score": _clean_number(score),
        "total_ects": _clean_number(total_ects),
        "conflict_count": conflict_count,
        "course_count": len(domains),
        "courses": courses,
        "variant_count": variant_count,
        "variants": variants,
    }


def _clean_number(value: float) -> int | float:
    return int(value) if value.is_integer() else value


def _schedule_sort_key(
    schedule: GeneratedSchedule,
) -> tuple[float, int, LayoutSignature]:
    return (
        -float(schedule["score"]),
        schedule["conflict_count"],
        layout_signature(schedule["courses"]),
    )


def _diversity_features(schedule: GeneratedSchedule) -> DiversityFeatures:
    slots = normalize_slots(
        [
            slot
            for course in schedule["courses"]
            for slot in slot_list(course.get("schedule", []))
        ]
    )
    periods_by_day: dict[str, set[int]] = {
        day: set() for day in tuple(_DAY_ORDER)[:5]
    }
    for day, period in slots:
        if day in periods_by_day:
            periods_by_day[day].add(period)

    total_gaps = 0
    all_periods: list[int] = []
    free_days = 0
    for periods in periods_by_day.values():
        if not periods:
            free_days += 1
            continue
        all_periods.extend(periods)
        total_gaps += max(periods) - min(periods) + 1 - len(periods)

    return DiversityFeatures(
        components=frozenset(layout_signature(schedule["courses"])),
        occupied_slots=frozenset(slots),
        free_days=free_days,
        total_gaps=total_gaps,
        earliest_period=min(all_periods, default=0),
        latest_period=max(all_periods, default=0),
    )


def _jaccard_distance(left: frozenset[object], right: frozenset[object]) -> float:
    union = left | right
    if not union:
        return 0.0
    return 1.0 - len(left & right) / len(union)


def _schedule_distance(
    left: DiversityFeatures,
    right: DiversityFeatures,
    max_gap: int,
    max_period: int,
) -> float:
    component_distance = _jaccard_distance(
        cast(frozenset[object], left.components),
        cast(frozenset[object], right.components),
    )
    occupancy_distance = _jaccard_distance(
        cast(frozenset[object], left.occupied_slots),
        cast(frozenset[object], right.occupied_slots),
    )
    metric_distance = (
        abs(left.free_days - right.free_days) / 5
        + abs(left.total_gaps - right.total_gaps) / max(max_gap, 1)
        + abs(left.earliest_period - right.earliest_period) / max(max_period, 1)
        + abs(left.latest_period - right.latest_period) / max(max_period, 1)
    ) / 4
    return (
        component_distance * 0.55
        + occupancy_distance * 0.25
        + metric_distance * 0.20
    )


def _select_diverse_schedules(
    schedules: list[GeneratedSchedule],
    limit: int,
) -> list[GeneratedSchedule]:
    """Select high-quality schedules while avoiding near-duplicate layouts."""
    ordered = sorted(schedules, key=_schedule_sort_key)
    if len(ordered) <= limit:
        return ordered

    features = [_diversity_features(schedule) for schedule in ordered]
    scores = [float(schedule["score"]) for schedule in ordered]
    minimum_score = min(scores)
    score_range = max(scores) - minimum_score
    max_gap = max(feature.total_gaps for feature in features)
    max_period = max(feature.latest_period for feature in features)

    selected_indices = [0]
    remaining_indices = list(range(1, len(ordered)))
    while remaining_indices and len(selected_indices) < limit:
        best_index = remaining_indices[0]
        best_key: tuple[float, float, float] | None = None
        for index in remaining_indices:
            quality = (
                1.0
                if score_range == 0
                else (scores[index] - minimum_score) / score_range
            )
            minimum_distance = min(
                _schedule_distance(
                    features[index],
                    features[selected],
                    max_gap,
                    max_period,
                )
                for selected in selected_indices
            )
            mmr_score = (
                quality * QUALITY_WEIGHT
                + minimum_distance * DIVERSITY_WEIGHT
            )
            key = (mmr_score, quality, minimum_distance)
            if best_key is None or key > best_key:
                best_index = index
                best_key = key

        selected_indices.append(best_index)
        remaining_indices.remove(best_index)

    return [ordered[index] for index in selected_indices]


def _search_layouts(
    domains: list[CourseDomain],
    max_ects: int,
    max_conflicts: int,
) -> tuple[list[GeneratedSchedule], SearchCounters]:
    counters = SearchCounters()
    schedules: list[GeneratedSchedule] = []
    selections: dict[int, LayoutChoice] = {}

    def visit(
        remaining: list[int],
        occupied_mask: int,
        current_conflicts: int,
        current_ects: float,
    ) -> bool:
        counters.explored_nodes += 1
        if not remaining:
            schedules.append(
                _materialize_schedule(domains, selections, current_conflicts)
            )
            if len(schedules) >= MAX_DISCOVERED_LAYOUTS:
                counters.search_complete = False
                return True
            return False

        index, candidates = _select_mrv_domain(
            remaining,
            domains,
            occupied_mask,
            current_conflicts,
            current_ects,
            max_conflicts,
            max_ects,
            counters,
        )
        if not candidates:
            counters.pruned_by_forward_check += 1
            return False

        next_remaining = [item for item in remaining if item != index]
        for choice in candidates:
            delta = _conflict_delta(occupied_mask, choice)
            next_mask = occupied_mask | choice.slot_mask
            next_conflicts = current_conflicts + delta
            next_ects = current_ects + choice.total_ects

            if next_remaining and not _forward_check(
                next_remaining,
                domains,
                next_mask,
                next_conflicts,
                next_ects,
                max_conflicts,
                max_ects,
            ):
                counters.pruned_by_forward_check += 1
                continue

            selections[index] = choice
            should_stop = visit(
                next_remaining,
                next_mask,
                next_conflicts,
                next_ects,
            )
            selections.pop(index, None)
            if should_stop:
                return True
        return False

    visit(list(range(len(domains))), 0, 0, 0.0)
    return schedules, counters


def _minimum_ects_with_conflict_limit(
    domains: list[CourseDomain],
    max_conflicts: int,
) -> float | None:
    """Find the exact minimum ECTS among assignments respecting conflicts."""
    best = inf

    def visit(
        remaining: list[int],
        occupied_mask: int,
        current_conflicts: int,
        current_ects: float,
    ) -> None:
        nonlocal best
        if current_ects + sum(domains[index].min_ects for index in remaining) >= best:
            return
        if not remaining:
            best = min(best, current_ects)
            return

        candidate_sets: list[tuple[int, list[LayoutChoice]]] = []
        for index in remaining:
            candidates = [
                choice
                for choice in domains[index].choices
                if current_conflicts + _conflict_delta(occupied_mask, choice)
                <= max_conflicts
            ]
            if not candidates:
                return
            candidates.sort(key=lambda choice: (choice.total_ects, choice.slot_mask))
            candidate_sets.append((index, candidates))

        index, candidates = min(
            candidate_sets,
            key=lambda item: (
                len(item[1]),
                -domains[item[0]].degree,
                domains[item[0]].main_code,
            ),
        )
        next_remaining = [item for item in remaining if item != index]
        for choice in candidates:
            visit(
                next_remaining,
                occupied_mask | choice.slot_mask,
                current_conflicts + _conflict_delta(occupied_mask, choice),
                current_ects + choice.total_ects,
            )

    visit(list(range(len(domains))), 0, 0, 0.0)
    return None if best == inf else best


def _empty_metadata(started_at: float) -> SearchMetadata:
    return {
        "algorithm": "dfs_mrv_bitmask",
        "selection_strategy": "quality_diversity_mmr",
        "search_complete": True,
        "elapsed_ms": round((perf_counter() - started_at) * 1000, 3),
        "explored_nodes": 0,
        "pruned_by_conflict": 0,
        "pruned_by_ects": 0,
        "pruned_by_forward_check": 0,
        "discovered_layouts": 0,
        "candidate_pool_size": 0,
    }


def generate_schedule_result(
    all_courses: list[CourseData],
    selected_main_codes: list[str],
    params: dict[str, object],
) -> GenerationResult:
    """Generate bounded exact results and structural diagnostics."""
    started_at = perf_counter()
    max_ects = get_int_param(params, "max_ects", 45)
    max_conflicts = get_int_param(params, "max_conflicts", 0)
    locked_slots = normalize_slots(params.get("locked_slots", []))

    domains, structural_reasons = _build_domains(
        all_courses,
        selected_main_codes,
        locked_slots,
    )
    if structural_reasons:
        return {
            "schedules": [],
            "diagnosis": {
                "status": "empty",
                "result_count": 0,
                "reasons": structural_reasons,
            },
            "metadata": _empty_metadata(started_at),
        }

    unconstrained_min_ects = sum(domain.min_ects for domain in domains)
    if unconstrained_min_ects > max_ects:
        reason: DiagnosisReason = {
            "code": "ects_exceeded",
            "data": {
                "limit": max_ects,
                "min_possible": _clean_number(unconstrained_min_ects),
            },
        }
        return {
            "schedules": [],
            "diagnosis": {
                "status": "empty",
                "result_count": 0,
                "reasons": [reason],
            },
            "metadata": _empty_metadata(started_at),
        }

    schedules, counters = _search_layouts(domains, max_ects, max_conflicts)
    discovered_layouts = len(schedules)
    returned_schedules = _select_diverse_schedules(
        schedules,
        MAX_RETURNED_SCHEDULES,
    )
    for index, schedule in enumerate(returned_schedules, start=1):
        schedule["id"] = str(index)

    reasons: list[DiagnosisReason] = []
    if not returned_schedules:
        minimum_conflict_feasible_ects = _minimum_ects_with_conflict_limit(
            domains,
            max_conflicts,
        )
        if minimum_conflict_feasible_ects is None:
            reasons.append(
                {
                    "code": "conflict_limit_exceeded",
                    "data": {"limit": max_conflicts},
                }
            )
        elif minimum_conflict_feasible_ects > max_ects:
            reasons.append(
                {
                    "code": "ects_exceeded",
                    "data": {
                        "limit": max_ects,
                        "min_possible": _clean_number(
                            minimum_conflict_feasible_ects
                        ),
                    },
                }
            )

    metadata: SearchMetadata = {
        "algorithm": "dfs_mrv_bitmask",
        "selection_strategy": "quality_diversity_mmr",
        "search_complete": counters.search_complete,
        "elapsed_ms": round((perf_counter() - started_at) * 1000, 3),
        "explored_nodes": counters.explored_nodes,
        "pruned_by_conflict": counters.pruned_by_conflict,
        "pruned_by_ects": counters.pruned_by_ects,
        "pruned_by_forward_check": counters.pruned_by_forward_check,
        "discovered_layouts": discovered_layouts,
        "candidate_pool_size": discovered_layouts,
    }
    return {
        "schedules": returned_schedules,
        "diagnosis": {
            "status": "ok" if returned_schedules else "empty",
            "result_count": len(returned_schedules),
            "reasons": reasons,
        },
        "metadata": metadata,
    }
