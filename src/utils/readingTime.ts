/**
 * Calculate estimated reading time based on content
 * Average reading speed: 200 words per minute (Portuguese)
 */
export const calculateReadingTime = (content: string): number => {
  if (!content) return 0;
  const plainText = content.replace(/<[^>]*>/g, '');
  const wordCount = plainText.split(/\s+/).filter(word => word.length > 0).length;
  return Math.max(1, Math.ceil(wordCount / 200));
};
