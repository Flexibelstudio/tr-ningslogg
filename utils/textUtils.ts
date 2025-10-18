// utils/textUtils.ts
import React from 'react';

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

const getIconForHeader = (headerText: string): React.ReactElement | null => {
  const lowerHeaderText = headerText.toLowerCase();
  const props = { className: "mr-2 text-xl", role: "img" };

  if (lowerHeaderText.includes("prognos")) return React.createElement('span', { ...props, 'aria-label': 'Prognos' }, '🔮');
  if (lowerHeaderText.includes("nyckelpass") || lowerHeaderText.includes("rekommendera")) return React.createElement('span', { ...props, 'aria-label': 'Rekommenderade pass' }, '🎟️');
  if (lowerHeaderText.includes("tänka på") || lowerHeaderText.includes("tips") || lowerHeaderText.includes("motivation")) return React.createElement('span', { ...props, 'aria-label': 'Tips' }, '💡');
  if (lowerHeaderText.includes("lycka till") || lowerHeaderText.includes("avslutning")) return React.createElement('span', { ...props, 'aria-label': 'Avslutning' }, '🎉');
  if (lowerHeaderText.includes("sammanfattning") || lowerHeaderText.includes("uppmuntran")) return React.createElement('span', { ...props, 'aria-label': 'Sammanfattning' }, '⭐');
  if (lowerHeaderText.includes("progress") || lowerHeaderText.includes("inbody") || lowerHeaderText.includes("styrka")) return React.createElement('span', { ...props, 'aria-label': 'Framsteg' }, '💪');
  if (lowerHeaderText.includes("mentalt välbefinnande") || lowerHeaderText.includes("balans")) return React.createElement('span', { ...props, 'aria-label': 'Mentalt välbefinnande' }, '🧘');
  if (lowerHeaderText.includes("observationer") || lowerHeaderText.includes("pass") || lowerHeaderText.includes("aktiviteter")) return React.createElement('span', { ...props, 'aria-label': 'Observationer' }, '👀');
  if (lowerHeaderText.includes("särskilda råd")) return React.createElement('span', { ...props, 'aria-label': 'Särskilda råd' }, 'ℹ️');
  return React.createElement('span', { ...props, 'aria-label': 'Rubrik' }, '📄');
};

export const renderMarkdown = (markdownText: string | null): React.ReactElement[] | null => {
  if (!markdownText) return null;

  const lines = markdownText.split('\n');
  const renderedElements: React.ReactElement[] = [];
  let currentListItems: React.ReactElement[] = [];
  let listKeySuffix = 0;

  const flushList = () => {
    if (currentListItems.length > 0) {
      renderedElements.push(
        React.createElement('ul', { key: `ul-${renderedElements.length}-${listKeySuffix}`, className: 'list-disc pl-5 space-y-1 my-2' }, ...currentListItems)
      );
      currentListItems = [];
      listKeySuffix++;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    let lineContent = lines[i];

    lineContent = lineContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    lineContent = lineContent.replace(/\*(?=\S)(.*?)(?<=\S)\*/g, '<em>$1</em>');
    lineContent = lineContent.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-flexibel hover:underline font-semibold">$1</a>');

    if (lineContent.startsWith('### ')) {
        flushList();
        const headerText = lineContent.substring(4).trim();
        const icon = getIconForHeader(headerText.replace(/<\/?(strong|em)>/g, ''));
        const spanElement = React.createElement('span', { dangerouslySetInnerHTML: { __html: headerText } });
        renderedElements.push(
          React.createElement('h5', { key: `h5-${i}`, className: 'text-lg font-bold text-gray-700 flex items-center mb-1 mt-3' }, icon, ' ', spanElement)
        );
    } else if (lineContent.startsWith('## ')) {
      flushList();
      const headerText = lineContent.substring(3).trim();
      const icon = getIconForHeader(headerText.replace(/<\/?(strong|em)>/g, ''));
      const spanElement = React.createElement('span', { dangerouslySetInnerHTML: { __html: headerText } });
      renderedElements.push(
        React.createElement('h4', { key: `h4-${i}`, className: 'text-xl font-bold text-gray-800 flex items-center mb-2 mt-4' }, icon, ' ', spanElement)
      );
    } else if (lineContent.startsWith('* ') || lineContent.startsWith('- ')) {
      const listItemText = lineContent.substring(2).trim();
      currentListItems.push(
        React.createElement('li', { key: `li-${i}`, className: 'text-base text-gray-700', dangerouslySetInnerHTML: { __html: listItemText } })
      );
    } else {
      flushList();
      if (lineContent.trim() !== '') {
        renderedElements.push(
          React.createElement('p', { key: `p-${i}`, className: 'text-base text-gray-700 mb-2', dangerouslySetInnerHTML: { __html: lineContent } })
        );
      }
    }
  }
  flushList();

  return renderedElements;
};
