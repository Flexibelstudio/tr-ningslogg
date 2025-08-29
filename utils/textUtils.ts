
// utils/textUtils.ts

export const stripMarkdown = (text: string): string => {
  if (!text) return "";

  let newText = text;

  // Remove headers (e.g., ## Header)
  newText = newText.replace(/^(#+)\s*(.*)/gm, '$2');

  // Remove bold (**text** or __text__)
  newText = newText.replace(/\*\*(.*?)\*\*|__(.*?)__/g, '$1$2');

  // Remove italic (*text* or _text_) - more specific to avoid removing all asterisks
  // This regex targets asterisks/underscores that are likely for italic emphasis
  // by checking for non-whitespace characters inside.
  newText = newText.replace(/\*(?=\S)(.*?)(?<=\S)\*|_(?=\S)(.*?)(?<=\S)_/g, '$1$2');
  
  // Remove strikethrough (~~text~~)
  newText = newText.replace(/~~(.*?)~~/g, '$1');

  // Remove list item markers (*, -, 1. followed by space)
  newText = newText.replace(/^\s*([*-]|\d+\.)\s+/gm, '');
  
  // Remove inline code ticks (`code`)
  newText = newText.replace(/`([^`]+)`/g, '$1');

  // Remove code blocks (```...```) - keep content
  newText = newText.replace(/```(\w*\n)?([\s\S]*?)```/g, '$2');
  
  // Remove blockquotes (> text)
  newText = newText.replace(/^>\s*(.*)/gm, '$1');

  // Remove horizontal rules (---, ***, ___)
  newText = newText.replace(/^(---|___|\*\*\*)\s*$/gm, '');

  // Remove images (![alt](url)) - keep alt text if present, otherwise remove fully
  newText = newText.replace(/!\[(.*?)\]\(.*?\)/g, '$1'); 
  // Remove links ([text](url)) - keep link text
  newText = newText.replace(/\[(.*?)\]\(.*?\)/g, '$1');

  // Normalize multiple newlines to preserve paragraph structure for whitespace-pre-wrap
  // Replace 3 or more newlines with two (effectively one empty line between paragraphs)
  newText = newText.replace(/\n{3,}/g, '\n\n');
  
  // Trim leading/trailing whitespace from the whole text
  // And trim each line individually to remove potential leading/trailing spaces from Markdown processing
  newText = newText.split('\n').map(line => line.trim()).join('\n').trim();

  return newText;
};
