"""Smoke tests for the schedule generation flow."""

from itertools import product

from app.api.routes.generate import generate_result_sync, generate_schedules_sync
from app.scheduling.solver import CourseData, ScheduleData


def _course(
    code: str,
    main_code: str,
    schedule: ScheduleData,
    *,
    course_type: str = "lecture",
    teacher: str = "Instructor",
    ects: int | float = 5,
) -> CourseData:
    return CourseData(
        code=code,
        main_code=main_code,
        name=main_code,
        type=course_type,
        teacher=teacher,
        ects=ects,
        schedule=schedule,
    )


def test_generate_happy_path(client, sample_xlsx_upload):
    response = client.post(
        "/api/generate",
        json={
            "file_id": sample_xlsx_upload["file_id"],
            "selected_main_codes": ["SOFT3215", "MATH1101"],
            "algorithm": "dfs",
        },
    )
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["job_id"]
    assert body["status"] in {"completed", "processing", "failed"}
    assert "message" in body


def test_generate_rejects_empty_selection(client, sample_xlsx_upload):
    response = client.post(
        "/api/generate",
        json={
            "file_id": sample_xlsx_upload["file_id"],
            "selected_main_codes": [],
        },
    )
    assert response.status_code == 400


def test_job_status_endpoint_returns_result(client, sample_xlsx_upload):
    start = client.post(
        "/api/generate",
        json={
            "file_id": sample_xlsx_upload["file_id"],
            "selected_main_codes": ["SOFT3215"],
        },
    )
    job_id = start.json()["job_id"]

    status = client.get(f"/api/jobs/{job_id}")
    assert status.status_code == 200, status.text
    payload = status.json()
    assert payload["job_id"] == job_id
    assert "status" in payload and "result" in payload

    schedules = payload["result"]["schedules"]
    assert schedules
    assert schedules[0]["courses"] == schedules[0]["variants"][0]
    assert schedules[0]["variant_count"] == 1
    assert payload["result"]["diagnosis"] == {
        "status": "ok",
        "result_count": 1,
        "reasons": [],
    }
    assert payload["result"]["metadata"]["algorithm"] == "dfs_mrv_bitmask"
    assert (
        payload["result"]["metadata"]["selection_strategy"]
        == "quality_diversity_mmr"
    )


def test_locked_sections_are_filtered_before_generation():
    courses = [
        *[
            _course(
                f"SOFT3215.{index:03}",
                "SOFT3215",
                [["Monday", 1]],
                teacher=f"Locked {index}",
            )
            for index in range(100)
        ],
        _course("SOFT3215.101", "SOFT3215", [["Tuesday", 2]], teacher="Available"),
    ]

    schedules = generate_schedules_sync(
        courses,
        ["SOFT3215"],
        "dfs",
        {"locked_slots": [["Monday", 1]]},
    )

    assert len(schedules) == 1
    assert schedules[0]["courses"][0]["code"] == "SOFT3215.101"
    assert schedules[0]["courses"][0]["schedule"] == [["Tuesday", 2]]


def test_selected_course_is_not_silently_dropped_when_locks_remove_all_options():
    courses = [
        _course("SOFT3215.01", "SOFT3215", [["Tuesday", 2]]),
        _course("MATH1101.01", "MATH1101", [["Monday", 1]]),
    ]

    schedules = generate_schedules_sync(
        courses,
        ["SOFT3215", "MATH1101"],
        "dfs",
        {"locked_slots": [["Monday", 1]]},
    )

    assert schedules == []


def test_locked_required_component_does_not_turn_into_lecture_only_option():
    courses = [
        _course("SOFT3215.01", "SOFT3215", [["Tuesday", 2]]),
        _course(
            "SOFT3215.LAB.1",
            "SOFT3215",
            [["Monday", 1]],
            course_type="lab",
            ects=0,
        ),
    ]

    schedules = generate_schedules_sync(
        courses,
        ["SOFT3215"],
        "dfs",
        {"locked_slots": [["Monday", 1]]},
    )

    assert schedules == []


def test_same_layout_sections_are_returned_as_bounded_variants():
    courses = [
        *[
            _course(
                f"SOFT3215.{index:02}",
                "SOFT3215",
                [["Monday", 1], ["Monday", 2]],
                teacher=f"Instructor {index}",
            )
            for index in range(1, 8)
        ],
        _course(
            "SOFT3215.08",
            "SOFT3215",
            [["Wednesday", 3], ["Wednesday", 4]],
            teacher="Different Layout",
        ),
    ]

    schedules = generate_schedules_sync(courses, ["SOFT3215"], "dfs", {})

    assert len(schedules) == 2
    grouped = next(schedule for schedule in schedules if schedule["variant_count"] == 7)
    assert len(grouped["variants"]) == 5
    assert grouped["courses"] == grouped["variants"][0]
    assert {variant[0].get("teacher") for variant in grouped["variants"]} == {
        "Instructor 1",
        "Instructor 2",
        "Instructor 3",
        "Instructor 4",
        "Instructor 5",
    }


def test_layout_signature_keeps_different_courses_separate():
    courses = [
        _course("SOFT3215.01", "SOFT3215", [["Monday", 1]]),
        _course("SOFT3215.02", "SOFT3215", [["Tuesday", 1]]),
        _course("MATH1101.01", "MATH1101", [["Tuesday", 1]]),
        _course("MATH1101.02", "MATH1101", [["Monday", 1]]),
    ]

    schedules = generate_schedules_sync(
        courses,
        ["SOFT3215", "MATH1101"],
        "dfs",
        {"max_conflicts": 0},
    )

    assert len(schedules) == 2
    assert all(schedule["variant_count"] == 1 for schedule in schedules)


def test_diagnosis_reports_missing_course():
    result = generate_result_sync(
        [_course("SOFT3215.01", "SOFT3215", [["Monday", 1]])],
        ["SOFT3215", "MATH1101"],
        "dfs",
        {},
    )

    assert result["schedules"] == []
    assert result["diagnosis"]["status"] == "empty"
    assert result["diagnosis"]["reasons"] == [
        {"code": "missing_course", "data": {"course": "MATH1101"}}
    ]


def test_diagnosis_reports_missing_required_lecture():
    result = generate_result_sync(
        [
            _course(
                "SOFT3215.LAB.1",
                "SOFT3215",
                [["Monday", 1]],
                course_type="lab",
                ects=0,
            )
        ],
        ["SOFT3215"],
        "dfs",
        {},
    )

    assert result["diagnosis"]["reasons"] == [
        {
            "code": "missing_required_component",
            "data": {"course": "SOFT3215", "type": "lecture"},
        }
    ]


def test_diagnosis_reports_locked_course():
    result = generate_result_sync(
        [_course("SOFT3215.01", "SOFT3215", [["Monday", 1]])],
        ["SOFT3215"],
        "dfs",
        {"locked_slots": [["Monday", 1]]},
    )

    assert result["diagnosis"]["reasons"] == [
        {"code": "locked_blocks_course", "data": {"course": "SOFT3215"}}
    ]
    assert result["metadata"]["explored_nodes"] == 0


def test_diagnosis_reports_proven_minimum_ects():
    result = generate_result_sync(
        [_course("SOFT3215.01", "SOFT3215", [["Monday", 1]], ects=6)],
        ["SOFT3215"],
        "dfs",
        {"max_ects": 5},
    )

    assert result["diagnosis"]["reasons"] == [
        {
            "code": "ects_exceeded",
            "data": {"limit": 5, "min_possible": 6},
        }
    ]


def test_diagnosis_reports_proven_conflict_limit():
    result = generate_result_sync(
        [
            _course("SOFT3215.01", "SOFT3215", [["Monday", 1]]),
            _course("MATH1101.01", "MATH1101", [["Monday", 1]]),
        ],
        ["SOFT3215", "MATH1101"],
        "dfs",
        {"max_conflicts": 0},
    )

    assert result["schedules"] == []
    assert result["diagnosis"]["reasons"] == [
        {"code": "conflict_limit_exceeded", "data": {"limit": 0}}
    ]
    assert result["metadata"]["search_complete"] is True
    assert result["metadata"]["pruned_by_forward_check"] > 0


def test_diagnosis_handles_joint_conflict_and_ects_constraints():
    result = generate_result_sync(
        [
            _course("SOFT3215.01", "SOFT3215", [["Monday", 1]], ects=3),
            _course("SOFT3215.02", "SOFT3215", [["Tuesday", 1]], ects=6),
            _course("MATH1101.01", "MATH1101", [["Monday", 1]], ects=2),
        ],
        ["SOFT3215", "MATH1101"],
        "dfs",
        {"max_conflicts": 0, "max_ects": 5},
    )

    assert result["schedules"] == []
    assert result["diagnosis"]["reasons"] == [
        {
            "code": "ects_exceeded",
            "data": {"limit": 5, "min_possible": 8},
        }
    ]


def test_exact_dfs_matches_brute_force_for_small_problem():
    course_options = {
        "SOFT3215": [
            _course("SOFT3215.01", "SOFT3215", [["Monday", 1]]),
            _course("SOFT3215.02", "SOFT3215", [["Tuesday", 1]]),
        ],
        "MATH1101": [
            _course("MATH1101.01", "MATH1101", [["Monday", 1]]),
            _course("MATH1101.02", "MATH1101", [["Wednesday", 1]]),
        ],
        "BUSI1302": [
            _course("BUSI1302.01", "BUSI1302", [["Tuesday", 1]]),
            _course("BUSI1302.02", "BUSI1302", [["Thursday", 1]]),
        ],
    }
    all_courses = [
        course
        for options in course_options.values()
        for course in options
    ]

    result = generate_result_sync(
        all_courses,
        list(course_options),
        "dfs",
        {"max_conflicts": 0},
    )

    expected = {
        tuple(sorted(course["code"] for course in combination))
        for combination in product(*course_options.values())
        if len(
            {
                tuple(slot)
                for course in combination
                for slot in course["schedule"]
            }
        )
        == sum(len(course["schedule"]) for course in combination)
    }
    actual = {
        tuple(sorted(course["code"] for course in schedule["courses"]))
        for schedule in result["schedules"]
    }

    assert result["metadata"]["search_complete"] is True
    assert actual == expected


def test_top_k_selection_keeps_a_distinct_layout_from_candidate_pool():
    clustered_slots = [
        (day, period)
        for day in ["Monday", "Tuesday", "Wednesday"]
        for period in range(3, 11)
    ]
    courses = [
        _course(
            f"SOFT3215.{index:02}",
            "SOFT3215",
            [["Monday", 1], ["Monday", 2], [day, period]],
        )
        for index, (day, period) in enumerate(clustered_slots, start=1)
    ]
    courses.append(
        _course(
            "SOFT3215.99",
            "SOFT3215",
            [["Friday", 8], ["Friday", 9], ["Friday", 10]],
        )
    )

    result = generate_result_sync(courses, ["SOFT3215"], "dfs", {})
    returned_codes = {
        schedule["courses"][0]["code"] for schedule in result["schedules"]
    }

    assert result["metadata"]["candidate_pool_size"] == 25
    assert len(result["schedules"]) == 20
    assert "SOFT3215.99" in returned_codes
