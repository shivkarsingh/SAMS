import { loginUser, registerUser } from "../services/authService.js";

function hasRequiredSignupFields(payload) {
  const commonFields = [
    "role",
    "firstName",
    "lastName",
    "userId",
    "password",
    "age",
    "gender",
    "department",
    "email",
    "phoneNumber"
  ];

  const studentFields =
    payload?.role === "student" ? ["batch", "yearOfPassing"] : [];

  const teacherFields =
    payload?.role === "teacher"
      ? ["designation", "specialization", "experienceYears", "joiningYear"]
      : [];

  return [...commonFields, ...studentFields, ...teacherFields].every(
    (field) => payload?.[field] !== undefined && payload?.[field] !== ""
  );
}

export async function signup(request, response) {
  const payload = request.body ?? {};

  if (!hasRequiredSignupFields(payload)) {
    response.status(400).json({
      message: "All signup fields are required."
    });
    return;
  }

  try {
    const user = await registerUser({
      ...payload,
      age: Number(payload.age),
      yearOfPassing: payload.yearOfPassing
        ? Number(payload.yearOfPassing)
        : undefined,
      experienceYears: payload.experienceYears
        ? Number(payload.experienceYears)
        : undefined,
      joiningYear: payload.joiningYear ? Number(payload.joiningYear) : undefined
    });

    response.status(201).json({
      message: "Account created successfully.",
      user
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : "Unable to create account."
    });
  }
}

export async function login(request, response) {
  const { role, userId, password } = request.body ?? {};

  if (!role || !userId || !password) {
    response.status(400).json({
      message: "role, userId, and password are required."
    });
    return;
  }

  try {
    const user = await loginUser({ role, userId, password });

    response.json({
      message: "Login successful.",
      user
    });
  } catch (error) {
    response.status(401).json({
      message:
        error instanceof Error ? error.message : "Unable to login user."
    });
  }
}
