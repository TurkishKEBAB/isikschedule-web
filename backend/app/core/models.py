"""
Core data models for IşıkSchedule.

Ported from SchedularV3 PyQt6 application.
Contains Course, Schedule, CourseGroup, and Academic models.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Set, Tuple, Optional, Literal, Any
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

# Type definitions
CourseType = Literal["lecture", "ps", "lab"]
TimeSlot = Tuple[str, int]  # (day, period)


@dataclass
class Course:
    """
    Represents a university course with all its properties.
    """
    code: str
    main_code: str
    name: str
    ects: int
    course_type: CourseType
    schedule: List[TimeSlot]
    teacher: Optional[str] = None
    has_lecture: bool = False
    faculty: str = "Unknown Faculty"
    department: str = "Unknown Department"
    campus: str = "Main"
    prerequisites: List[str] = field(default_factory=list)
    corequisites: List[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Course':
        """Create a Course object from a dictionary."""
        if "code" not in data:
            raise ValueError("Missing required field 'code' in Course data")
        if "main_code" not in data:
            raise ValueError("Missing required field 'main_code' in Course data")
        if "schedule" not in data:
            raise ValueError("Missing required field 'schedule' in Course data")
        
        return cls(
            code=data["code"],
            main_code=data["main_code"],
            name=data.get("course_name", data.get("name", "Unknown Course")),
            ects=data.get("credit", data.get("ects", data.get("ECTS", 0))),
            course_type=data.get("course_type", data.get("type", "lecture")),
            schedule=data["schedule"],
            teacher=data.get("teacher"),
            has_lecture=data.get("has_lecture", data.get("hasLecture", False)),
            faculty=data.get("faculty", "Unknown Faculty"),
            department=data.get("department", "Unknown Department"),
            campus=data.get("campus", "Main")
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert Course object to a dictionary."""
        return {
            "code": self.code,
            "main_code": self.main_code,
            "name": self.name,
            "ects": self.ects,
            "type": self.course_type,
            "schedule": self.schedule,
            "hasLecture": self.has_lecture,
            "teacher": self.teacher,
            "faculty": self.faculty,
            "department": self.department,
            "campus": self.campus
        }

    def conflicts_with(self, other: 'Course') -> bool:
        """Check if this course conflicts with another course."""
        my_slots = set(self.schedule)
        other_slots = set(other.schedule)
        return bool(my_slots.intersection(other_slots))

    def get_conflict_slots(self, other: 'Course') -> Set[TimeSlot]:
        """Get the specific time slots where this course conflicts with another."""
        my_slots = set(self.schedule)
        other_slots = set(other.schedule)
        return my_slots.intersection(other_slots)

    def __str__(self) -> str:
        return f"{self.code} - {self.name} ({self.ects} ECTS)"

    def __repr__(self) -> str:
        return f"Course(code='{self.code}', name='{self.name}', ects={self.ects})"
    
    def __hash__(self) -> int:
        return hash(self.code)
    
    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Course):
            return NotImplemented
        return self.code == other.code


@dataclass
class Schedule:
    """
    Represents a complete schedule containing multiple courses.
    """
    courses: List[Course] = field(default_factory=list)

    @property
    def total_credits(self) -> int:
        """Calculate the total ECTS credits for this schedule."""
        return sum(course.ects for course in self.courses)

    @property
    def conflict_count(self) -> int:
        """Calculate the number of time slot conflicts in this schedule."""
        slot_courses: Dict[TimeSlot, List[Course]] = defaultdict(list)
        conflict_slots = set()

        for course in self.courses:
            for slot in course.schedule:
                slot_courses[slot].append(course)
                if len(slot_courses[slot]) > 1:
                    conflict_slots.add(slot)

        return len(conflict_slots)

    @property
    def has_conflicts(self) -> bool:
        """Check if this schedule has any conflicts."""
        return self.conflict_count > 0

    def add_course(self, course: Course) -> None:
        """Add a course to the schedule."""
        self.courses.append(course)

    def remove_course(self, course_code: str) -> bool:
        """Remove a course by code."""
        for i, course in enumerate(self.courses):
            if course.code == course_code:
                self.courses.pop(i)
                return True
        return False

    def get_course_codes(self) -> Set[str]:
        """Get set of all course codes in the schedule."""
        return {course.code for course in self.courses}

    def get_main_codes(self) -> Set[str]:
        """Get set of all main codes in the schedule."""
        return {course.main_code for course in self.courses}

    def to_dict_list(self) -> List[Dict[str, Any]]:
        """Convert the schedule to a list of dictionaries."""
        return [course.to_dict() for course in self.courses]

    @classmethod
    def from_dict_list(cls, dict_list: List[Dict[str, Any]]) -> 'Schedule':
        """Create a Schedule from a list of course dictionaries."""
        return cls([Course.from_dict(course_dict) for course_dict in dict_list])

    def get_statistics(self) -> Dict[str, Any]:
        """Get statistics about this schedule."""
        return {
            "total_courses": len(self.courses),
            "total_credits": self.total_credits,
            "conflict_count": self.conflict_count,
            "has_conflicts": self.has_conflicts
        }

    def __len__(self) -> int:
        return len(self.courses)

    def __str__(self) -> str:
        return f"Schedule({len(self.courses)} courses, {self.total_credits} ECTS, {self.conflict_count} conflicts)"


@dataclass
class CourseGroup:
    """
    Represents a group of related course sections (lecture, PS, lab).
    """
    main_code: str
    courses: List[Course] = field(default_factory=list)

    @property
    def lecture_courses(self) -> List[Course]:
        return [c for c in self.courses if c.course_type == "lecture"]

    @property
    def ps_courses(self) -> List[Course]:
        return [c for c in self.courses if c.course_type == "ps"]

    @property
    def lab_courses(self) -> List[Course]:
        return [c for c in self.courses if c.course_type == "lab"]

    @property
    def name(self) -> str:
        if self.courses:
            return self.courses[0].name
        return "Unknown Course"


@dataclass
class Grade:
    """Represents a grade for a completed course."""
    course_code: str
    course_name: str
    ects: int
    letter_grade: str
    numeric_grade: float
    semester: str
    is_retake: bool = False
    
    def is_passing(self) -> bool:
        """Check if grade is passing (>= DD/1.0)."""
        return self.numeric_grade >= 1.0
    
    @staticmethod
    def letter_to_numeric(letter: str) -> float:
        """Convert letter grade to numeric grade (0.0-4.0)."""
        grade_scale = {
            "AA": 4.00, "BA": 3.50, "BB": 3.00, "CB": 2.50,
            "CC": 2.00, "DC": 1.50, "DD": 1.00, "FD": 0.50, "FF": 0.00,
            "P": 0.00, "F": 0.00, "W": 0.00, "I": 0.00, "NA": 0.00,
        }
        return grade_scale.get(letter.upper(), 0.0)


@dataclass
class Transcript:
    """Student transcript with all completed courses."""
    student_id: str
    student_name: str
    program: str
    grades: List[Grade] = field(default_factory=list)
    
    def get_gpa(self) -> float:
        """Calculate current GPA."""
        if not self.grades:
            return 0.0
        total_points = sum(g.numeric_grade * g.ects for g in self.grades)
        total_ects = sum(g.ects for g in self.grades)
        return total_points / total_ects if total_ects > 0 else 0.0
    
    def get_total_ects(self) -> int:
        """Get total ECTS earned."""
        return sum(g.ects for g in self.grades if g.is_passing())
    
    def get_completed_courses(self) -> List[str]:
        """Get list of completed course codes."""
        return [g.course_code for g in self.grades if g.is_passing()]


# Helper functions

def build_course_groups(courses: List[Course]) -> Dict[str, CourseGroup]:
    """Build course groups from a list of courses."""
    groups: Dict[str, CourseGroup] = {}
    for course in courses:
        main_code = course.main_code
        if main_code not in groups:
            groups[main_code] = CourseGroup(main_code=main_code)
        groups[main_code].courses.append(course)
    return groups


def calculate_total_credits(courses: List[Course]) -> int:
    """Calculate total ECTS credits for a list of courses."""
    return sum(c.ects for c in courses)
