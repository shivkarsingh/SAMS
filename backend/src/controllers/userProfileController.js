import {
  requestProfileEmailVerification,
  updateUserProfile
} from "../services/userProfileService.js";

export async function sendProfileEmailOtp(request, response) {
  const { role, userId } = request.params;
  const { email } = request.body ?? {};

  if (!role || !userId || !email) {
    response.status(400).json({
      message: "role, userId, and email are required."
    });
    return;
  }

  try {
    const result = await requestProfileEmailVerification({
      role,
      userId,
      email
    });

    response.json({
      message: "Profile email verification OTP sent.",
      ...result
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to send profile email OTP."
    });
  }
}

export async function patchUserProfile(request, response) {
  const { role, userId } = request.params;
  const { emailOtp, ...updates } = request.body ?? {};

  if (!role || !userId) {
    response.status(400).json({
      message: "role and userId are required."
    });
    return;
  }

  try {
    const user = await updateUserProfile({
      role,
      userId,
      updates,
      emailOtp
    });

    response.json({
      message: "Profile updated successfully.",
      user
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : "Unable to update profile."
    });
  }
}
