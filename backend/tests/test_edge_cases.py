import pytest
from app.scheduling.solver import generate_schedule_result

def test_0_state_no_courses():
    res = generate_schedule_result([], [], {})
    assert len(res['schedules']) == 0
    assert res['diagnosis']['status'] == 'empty'

def test_locks_pre_filter():
    courses = [
        {'code': 'CS101', 'main_code': 'CS101', 'name': 'CS', 'ects': 5, 'type': 'lecture', 'schedule': [('Monday', 1)]},
        {'code': 'CS102', 'main_code': 'CS102', 'name': 'CS', 'ects': 5, 'type': 'lecture', 'schedule': [('Tuesday', 1)]}
    ]
    res = generate_schedule_result(courses, ['CS101', 'CS102'], {'locked_slots': [['Monday', 1]]})
    assert len(res['schedules']) == 0

def test_variant_grouping():
    courses = [
        {'code': 'CS101-1', 'main_code': 'CS101', 'name': 'CS', 'ects': 5, 'type': 'lecture', 'schedule': [('Monday', 1)], 'teacher': 'A'},
        {'code': 'CS101-2', 'main_code': 'CS101', 'name': 'CS', 'ects': 5, 'type': 'lecture', 'schedule': [('Monday', 1)], 'teacher': 'B'},
        {'code': 'CS102', 'main_code': 'CS102', 'name': 'CS', 'ects': 5, 'type': 'lecture', 'schedule': [('Tuesday', 1)], 'teacher': 'C'}
    ]
    res = generate_schedule_result(courses, ['CS101', 'CS102'], {})
    assert len(res['schedules']) == 1
    assert len(res['schedules'][0]['variants']) == 2
    assert res['schedules'][0]['variant_count'] == 2
