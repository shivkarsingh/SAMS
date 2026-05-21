export function resolveStudentDisplayPhotoUrl(user, faceProfile) {
  return (
    String(user?.avatarDataUrl ?? "").trim() ||
    String(faceProfile?.profilePhotoUrl ?? "").trim() ||
    ""
  );
}
