import assert from "node:assert/strict";
import test from "node:test";
import {
  findStudentRollConflict,
  isSameRollScope,
  normalizeStudentScopeValue
} from "../src/utils/studentRollNumberScope.js";

test("normalizes branch and semester scope values", () => {
  assert.equal(normalizeStudentScopeValue("  computer   science "), "COMPUTER SCIENCE");
  assert.equal(normalizeStudentScopeValue("sem 3"), "SEM 3");
});

test("allows same roll number in different branches", () => {
  const existingStudents = [
    {
      userId: "CSE-001",
      rollNumber: "10",
      department: "Computer Science",
      semesterLabel: "Sem 3"
    }
  ];

  const conflict = findStudentRollConflict(existingStudents, {
    rollNumber: "10",
    department: "Electrical",
    semesterLabel: "Sem 3"
  });

  assert.equal(conflict, null);
});

test("allows same roll number in same branch but different semester", () => {
  const existingStudents = [
    {
      userId: "CSE-001",
      rollNumber: "10",
      department: "Computer Science",
      semesterLabel: "Sem 3"
    }
  ];

  const conflict = findStudentRollConflict(existingStudents, {
    rollNumber: "10",
    department: "Computer Science",
    semesterLabel: "Sem 4"
  });

  assert.equal(conflict, null);
});

test("blocks same roll number in same branch and same semester", () => {
  const existingStudent = {
    userId: "CSE-001",
    rollNumber: "10",
    department: "Computer Science",
    semesterLabel: "Sem 3"
  };

  assert.equal(
    isSameRollScope(existingStudent, {
      rollNumber: "10",
      department: " computer science ",
      semesterLabel: "sem 3"
    }),
    true
  );

  assert.equal(
    findStudentRollConflict([existingStudent], {
      rollNumber: "10",
      department: "Computer Science",
      semesterLabel: "Sem 3"
    }),
    existingStudent
  );
});

test("ignores the same student when editing roll details", () => {
  const conflict = findStudentRollConflict(
    [
      {
        userId: "CSE-001",
        rollNumber: "10",
        department: "Computer Science",
        semesterLabel: "Sem 3"
      }
    ],
    {
      rollNumber: "10",
      department: "Computer Science",
      semesterLabel: "Sem 3"
    },
    "CSE-001"
  );

  assert.equal(conflict, null);
});
