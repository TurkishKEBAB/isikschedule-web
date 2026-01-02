"""
Excel import for IşıkSchedule Web Backend.

Ported from SchedularV3 PyQt6 application.
Handles Işık University Excel format with proper time slot parsing.
"""

import pandas as pd
import logging
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Literal, Union

logger = logging.getLogger(__name__)

# Type definitions
TimeSlot = Tuple[str, int]
CourseType = Literal["lecture", "lab", "ps"]

# Day name mappings
DAY_MAP = {
    "M": "Monday",
    "T": "Tuesday",
    "W": "Wednesday",
    "Th": "Thursday",
    "F": "Friday",
    "S": "Saturday",
    "Su": "Sunday"
}

# Turkish to English column mappings
COLUMN_MAP = {
    "Ders Kodu": "code",
    "Course Code": "code",
    "Kod": "code",
    "Başlık": "name",
    "Course Name": "name",
    "Ders Adı": "name",
    "Ders İsmi": "name",
    "Title": "name",
    "AKTS Kredisi": "ects",
    "AKTS": "ects",
    "ECTS": "ects",
    "Kredi": "ects",
    "Credit": "ects",
    "Kampüs": "campus",
    "Campus": "campus",
    "Eğitmen Adı": "teacher_first",
    "Teacher First Name": "teacher_first",
    "Eğitmen Soyadı": "teacher_last",
    "Teacher Last Name": "teacher_last",
    "Fakülte Adı": "faculty",
    "Faculty": "faculty",
    "Fakülte": "faculty",
    "Ders Saati": "schedule",
    "Schedule": "schedule",
    "Time Slots": "schedule",
    "Zaman": "schedule"
}


def parse_time_slot(slot_str: str) -> Optional[TimeSlot]:
    """Parse a single time slot string like 'M1', 'Th5' into (day, period)."""
    slot_str = slot_str.strip()
    if not slot_str:
        return None

    # Try two-character day codes first (Th, Su)
    for abbr, full_name in [("Th", "Thursday"), ("Su", "Sunday")]:
        if slot_str.startswith(abbr):
            try:
                period_str = slot_str[len(abbr):].strip()
                if period_str:
                    period = int(period_str)
                    if period > 0:
                        return (full_name, period)
            except ValueError:
                pass

    # Try single-character day codes
    if len(slot_str) >= 2:
        day_abbr = slot_str[0]
        if day_abbr in DAY_MAP:
            try:
                period_str = slot_str[1:].strip()
                if period_str:
                    period = int(period_str)
                    if period > 0:
                        return (DAY_MAP[day_abbr], period)
            except ValueError:
                pass

    return None


def parse_schedule(schedule_str: str) -> List[TimeSlot]:
    """Parse schedule string like 'M1, M2, T3' into list of TimeSlot tuples."""
    if not schedule_str or pd.isna(schedule_str):
        return []

    schedule_str = str(schedule_str).strip()
    if not schedule_str:
        return []

    # Skip pure numbers
    try:
        float(schedule_str)
        return []
    except ValueError:
        pass

    slots = []
    for slot in schedule_str.split(","):
        parsed = parse_time_slot(slot)
        if parsed:
            slots.append(parsed)

    return slots


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize column names from Turkish/English to standard names."""
    column_mapping = {}
    for col in df.columns:
        if col in COLUMN_MAP:
            column_mapping[col] = COLUMN_MAP[col]
    return df.rename(columns=column_mapping)


def determine_course_type(code: str) -> CourseType:
    """Determine course type from course code."""
    if not code:
        return "lecture"
    code_upper = code.upper()
    if "-L." in code_upper or "-LAB." in code_upper or code_upper.endswith("-L"):
        return "lab"
    elif "-PS." in code_upper or code_upper.endswith("-PS"):
        return "ps"
    return "lecture"


def extract_main_code(code: str) -> str:
    """Extract main course code without section info."""
    if not code:
        return ""
    for sep in ["-", "."]:
        if sep in code:
            return code.split(sep)[0].strip()
    return code.strip()


def process_excel(file_path: Union[str, Path], sheet_name: Union[str, int] = 0) -> List[Dict]:
    """
    Load courses from an Excel file in Işık University format.
    
    Returns list of course dictionaries for JSON serialization.
    """
    file_path = Path(file_path)

    if not file_path.exists():
        raise FileNotFoundError(f"Excel file not found: {file_path}")

    # Read Excel file
    df = pd.read_excel(str(file_path), sheet_name=sheet_name)
    logger.info(f"Loaded Excel file with {len(df)} rows")

    # Normalize column names
    df = normalize_columns(df)

    # Check for required columns
    required = ["code", "name"]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}. Available: {list(df.columns)}")

    courses = []

    for idx, row in df.iterrows():
        try:
            # Parse basic info
            code = str(row["code"]).strip() if pd.notna(row["code"]) else ""
            if not code or code == "nan":
                continue

            name = str(row["name"]).strip() if pd.notna(row["name"]) else ""
            if not name or name == "nan":
                continue

            # Parse ECTS
            ects = 0
            if "ects" in df.columns and pd.notna(row.get("ects")):
                try:
                    ects = int(float(row["ects"]))
                except (ValueError, TypeError):
                    ects = 0

            # Parse schedule
            schedule_str = ""
            if "schedule" in df.columns and pd.notna(row.get("schedule")):
                sched_value = row["schedule"]
                if isinstance(sched_value, pd.Series):
                    for val in sched_value:
                        if pd.notna(val) and str(val).strip() and any(c.isalpha() for c in str(val)):
                            schedule_str = str(val).strip()
                            break
                else:
                    schedule_str = str(sched_value).strip()

            schedule = parse_schedule(schedule_str)

            # Determine course type and main code
            course_type = determine_course_type(code)
            main_code = extract_main_code(code)

            # Build teacher name
            teacher = None
            if "teacher_first" in df.columns and "teacher_last" in df.columns:
                first = str(row.get("teacher_first", "")).strip()
                last = str(row.get("teacher_last", "")).strip()
                if first != "nan" and last != "nan":
                    if first and last:
                        teacher = f"{first} {last}"
                    elif first:
                        teacher = first
                    elif last:
                        teacher = last

            # Get optional fields
            faculty = "Unknown Faculty"
            if "faculty" in df.columns and pd.notna(row.get("faculty")):
                fac_str = str(row["faculty"]).strip()
                if fac_str and fac_str != "nan":
                    faculty = fac_str

            campus = "Main"
            if "campus" in df.columns and pd.notna(row.get("campus")):
                camp_str = str(row["campus"]).strip()
                if camp_str and camp_str != "nan":
                    campus = camp_str

            # Create course dict
            course = {
                "code": code,
                "main_code": main_code,
                "name": name,
                "ects": ects,
                "type": course_type,
                "schedule": schedule,
                "schedule_str": schedule_str,
                "teacher": teacher,
                "faculty": faculty,
                "campus": campus
            }

            courses.append(course)

        except Exception as e:
            logger.warning(f"Error processing row {idx}: {e}")
            continue

    logger.info(f"Successfully loaded {len(courses)} courses")
    return courses
