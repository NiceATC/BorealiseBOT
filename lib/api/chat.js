export function createChatCalls(api) {
  return {
    sendMessage: (slug, data) => api.chat.sendMessage(slug, data),
    getMessages: (slug, before, limit) =>
      api.chat.getMessages(slug, before, limit),
    editMessage: (slug, messageId, data) =>
      api.chat.editMessage(slug, messageId, data),
    deleteMessage: (slug, messageId) => api.chat.deleteMessage(slug, messageId),
  };
}
