import {
  createClassDiscussionMessage,
  createClassDiscussionReply,
  getClassDiscussion,
  toggleClassDiscussionReaction
} from "../services/classDiscussionService.js";

export async function listClassDiscussion(request, response) {
  const { classId } = request.params;
  const { userId, role } = request.query ?? {};

  if (!classId || !userId || !role) {
    response.status(400).json({
      message: "classId, userId, and role are required."
    });
    return;
  }

  try {
    const discussion = await getClassDiscussion({
      classId,
      userId,
      role
    });

    response.json(discussion);
  } catch (error) {
    response.status(403).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to load class discussion."
    });
  }
}

export async function postClassDiscussionMessage(request, response) {
  const { classId } = request.params;
  const { userId, role, message } = request.body ?? {};

  if (!classId || !userId || !role || !message) {
    response.status(400).json({
      message: "classId, userId, role, and message are required."
    });
    return;
  }

  try {
    const discussionMessage = await createClassDiscussionMessage({
      classId,
      userId,
      role,
      message
    });

    response.status(201).json({
      message: "Discussion message posted.",
      discussionMessage
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to post discussion message."
    });
  }
}

export async function postClassDiscussionReply(request, response) {
  const { classId, messageId } = request.params;
  const { userId, role, message } = request.body ?? {};

  if (!classId || !messageId || !userId || !role || !message) {
    response.status(400).json({
      message: "classId, messageId, userId, role, and message are required."
    });
    return;
  }

  try {
    const discussionMessage = await createClassDiscussionReply({
      classId,
      messageId,
      userId,
      role,
      message
    });

    response.status(201).json({
      message: "Reply posted.",
      discussionMessage
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : "Unable to post reply."
    });
  }
}

export async function postClassDiscussionReaction(request, response) {
  const { classId, messageId } = request.params;
  const { userId, role, reaction } = request.body ?? {};

  if (!classId || !messageId || !userId || !role || !reaction) {
    response.status(400).json({
      message: "classId, messageId, userId, role, and reaction are required."
    });
    return;
  }

  try {
    const discussionMessage = await toggleClassDiscussionReaction({
      classId,
      messageId,
      userId,
      role,
      reaction
    });

    response.json({
      message: "Reaction updated.",
      discussionMessage
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : "Unable to update reaction."
    });
  }
}
