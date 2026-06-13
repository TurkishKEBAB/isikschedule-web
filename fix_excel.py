import os
import re

file_path = r"c:\Develop\Projects\isikschedule-web\backend\app\core\excel_loader.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

new_logic = """    courses = []

    def get_first_valid(val):
        \"\"\"Extract first valid string from scalar or pandas Series.\"\"\"
        if isinstance(val, pd.Series):
            for v in val:
                if pd.notna(v) and str(v).strip() and str(v).strip() != "nan":
                    return str(v).strip()
            return ""
        if pd.notna(val) and str(val).strip() and str(val).strip() != "nan":
            return str(val).strip()
        return ""

    for idx, row in df.iterrows():
        try:
            # Parse basic info
            code = get_first_valid(row.get("code"))
            if not code:
                continue

            name = get_first_valid(row.get("name"))
            if not name:
                continue

            # Parse ECTS
            ects = 0
            if "ects" in df.columns:
                ects_val = row.get("ects")
                if isinstance(ects_val, pd.Series):
                    for val in reversed(list(ects_val)):
                        if pd.notna(val) and str(val).strip() and str(val).strip() != "nan":
                            try:
                                ects = int(float(val))
                                break
                            except (ValueError, TypeError):
                                pass
                elif pd.notna(ects_val) and str(ects_val).strip() != "nan":
                    try:
                        ects = int(float(ects_val))
                    except (ValueError, TypeError):
                        pass

            # Parse schedule
            schedule_str = ""
            if "schedule" in df.columns:
                sched_value = row.get("schedule")
                if isinstance(sched_value, pd.Series):
                    for val in sched_value:
                        if pd.notna(val) and str(val).strip() and str(val).strip() != "nan" and any(c.isalpha() for c in str(val)):
                            schedule_str = str(val).strip()
                            break
                elif pd.notna(sched_value) and str(sched_value).strip() != "nan":
                    schedule_str = str(sched_value).strip()

            schedule = parse_schedule(schedule_str)

            # Determine course type and main code
            course_type = determine_course_type(code)
            main_code = extract_main_code(code)

            # Build teacher name
            teacher = None
            if "teacher_first" in df.columns and "teacher_last" in df.columns:
                first = get_first_valid(row.get("teacher_first"))
                last = get_first_valid(row.get("teacher_last"))
                if first and last:
                    teacher = f"{first} {last}"
                elif first:
                    teacher = first
                elif last:
                    teacher = last

            # Get optional fields
            faculty = get_first_valid(row.get("faculty")) or "Unknown Faculty"
            campus = get_first_valid(row.get("campus")) or "Main"

            # Create course dict"""

old_logic_pattern = re.compile(r"    courses = \[\].*?            # Create course dict", re.DOTALL)
content = old_logic_pattern.sub(new_logic, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("File patched successfully.")
