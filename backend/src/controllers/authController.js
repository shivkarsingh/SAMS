import {
  loginUser,
  requestPasswordReset,
  requestSignupEmailVerification,
  registerUser,
  resendUserEmailVerification,
  verifySignupEmailVerification,
  verifyUserEmail,
  verifyPasswordResetOtp,
  resetUserPassword
} from "../services/authService.js";

function getErrorResponse(error, fallbackMessage) {
  return {
    message: error instanceof Error ? error.message : fallbackMessage,
    ...(error?.retryAfterSeconds
      ? { retryAfterSeconds: error.retryAfterSeconds }
      : {})
  };
}

function hasRequiredSignupFields(payload) {
  const commonFields = [
    "role",
    "firstName",
    "lastName",
    "userId",
    "email",
    "password",
    "confirmPassword"
  ];

  const studentFields =
    payload?.role === "student" ? ["rollNumber", "emailOtp"] : [];

  const teacherFields = [];

  return [...commonFields, ...studentFields, ...teacherFields].every(
    (field) => payload?.[field] !== undefined && payload?.[field] !== ""
  );
}

export async function signup(request, response) {
  const payload = request.body ?? {};

  if (!hasRequiredSignupFields(payload)) {
    response.status(400).json({
      message: "Please complete the required signup fields."
    });
    return;
  }

  try {
    const result = await registerUser({
      ...payload,
      age: payload.age ? Number(payload.age) : undefined,
      rollNumber: payload.rollNumber,
      yearOfPassing: payload.yearOfPassing
        ? Number(payload.yearOfPassing)
        : undefined,
      experienceYears: payload.experienceYears
        ? Number(payload.experienceYears)
        : undefined,
      joiningYear: payload.joiningYear ? Number(payload.joiningYear) : undefined
    });

    response.status(201).json({
      message: "Account created. You can now log in.",
      ...result
    });
  } catch (error) {
    response.status(400).json(getErrorResponse(error, "Unable to create account."));
  }
}

export async function requestSignupEmailOtp(request, response) {
  const { role, userId, firstName, lastName, email } = request.body ?? {};

  if (!role || !email) {
    response.status(400).json({
      message: "role and email are required."
    });
    return;
  }

  try {
    const result = await requestSignupEmailVerification({
      role,
      userId,
      firstName,
      lastName,
      email
    });

    response.json({
      message: "Email OTP sent.",
      ...result
    });
  } catch (error) {
    response
      .status(400)
      .json(getErrorResponse(error, "Unable to send email OTP."));
  }
}

export async function verifySignupEmailOtp(request, response) {
  const { role, email, otp } = request.body ?? {};

  if (!role || !email || !otp) {
    response.status(400).json({
      message: "role, email, and otp are required."
    });
    return;
  }

  try {
    const result = await verifySignupEmailVerification({ role, email, otp });

    response.json({
      message: "Email verified successfully.",
      ...result
    });
  } catch (error) {
    response
      .status(400)
      .json(getErrorResponse(error, "Unable to verify email OTP."));
  }
}

export async function verifyEmail(request, response) {
  const { role, userId, otp } = request.body ?? {};

  if (!role || !userId || !otp) {
    response.status(400).json({
      message: "role, userId, and otp are required."
    });
    return;
  }

  try {
    const result = await verifyUserEmail({ role, userId, otp });

    response.json({
      message: "Email verified successfully.",
      ...result
    });
  } catch (error) {
    response.status(400).json(getErrorResponse(error, "Unable to verify email."));
  }
}

export async function resendVerificationEmail(request, response) {
  const { role, userId } = request.body ?? {};

  if (!role || !userId) {
    response.status(400).json({
      message: "role and userId are required."
    });
    return;
  }

  try {
    const result = await resendUserEmailVerification({ role, userId });

    response.json({
      message: "Verification OTP sent.",
      ...result
    });
  } catch (error) {
    response
      .status(400)
      .json(getErrorResponse(error, "Unable to resend verification email."));
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
    response.status(401).json(getErrorResponse(error, "Unable to login user."));
  }
}

export async function resetPassword(request, response) {
  const { role, userId, otp, resetToken, password, confirmPassword } =
    request.body ?? {};

  if (!role || !userId || !password || !confirmPassword || (!otp && !resetToken)) {
    response.status(400).json({
      message:
        "role, userId, verified reset session, password, and confirmPassword are required."
    });
    return;
  }

  try {
    const user = await resetUserPassword({
      role,
      userId,
      otp,
      resetToken,
      password,
      confirmPassword
    });

    response.json({
      message: "Password reset successfully.",
      user
    });
  } catch (error) {
    response.status(400).json(getErrorResponse(error, "Unable to reset password."));
  }
}

export async function verifyPasswordResetCode(request, response) {
  const { role, userId, otp } = request.body ?? {};

  if (!role || !userId || !otp) {
    response.status(400).json({
      message: "role, userId, and otp are required."
    });
    return;
  }

  try {
    const result = await verifyPasswordResetOtp({ role, userId, otp });

    response.json({
      message: "OTP verified. Enter your new password.",
      ...result
    });
  } catch (error) {
    response
      .status(400)
      .json(getErrorResponse(error, "Unable to verify password reset OTP."));
  }
}

export async function requestPasswordResetEmail(request, response) {
  const { role, userId } = request.body ?? {};

  if (!role || !userId) {
    response.status(400).json({
      message: "role and userId are required."
    });
    return;
  }

  try {
    const result = await requestPasswordReset({ role, userId });

    response.json({
      message: "Password reset OTP sent.",
      ...result
    });
  } catch (error) {
    response
      .status(400)
      .json(getErrorResponse(error, "Unable to send password reset OTP."));
  }
}
