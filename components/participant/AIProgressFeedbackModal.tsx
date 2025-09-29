import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
// stripMarkdown is not used for rendering main content anymore.
// It might be used if there was a "copy raw text" feature, but not for display.

interface AIProgressFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  aiFeedback: string | null; // Expects raw Markdown here
  error: string | null;
  modalTitle?: string; // New prop for dynamic title
}

const getIconForHeader = (headerText: string): JSX.Element | null => {
  const lowerHeaderText = headerText.toLowerCase();
  if (lowerHeaderText.includes("prognos")) return <span className="mr-2 text-xl" role="img" aria-label="Prognos">🔮</span>;
  if (lowerHeaderText.includes("nyckelpass") || lowerHeaderText.includes("rekommendera")) return <span className="mr-2 text-xl" role="img" aria-label="Rekommenderade pass">🎟️</span>;
  if (lowerHeaderText.includes("tänka på") || lowerHeaderText.includes("tips") || lowerHeaderText.includes("motivation")) return <span className="mr-2 text-xl" role="img" aria-label="Tips">💡</span>;
  if (lowerHeaderText.includes("lycka till") || lowerHeaderText.includes("avslutning")) return <span className="mr-2 text-xl" role="img" aria-label="Avslutning">🎉</span>;

  // Fallback for older or other summary types
  if (lowerHeaderText.includes("sammanfattning") || lowerHeaderText.includes("uppmuntran")) return <span className="mr-2 text-xl" role="img" aria-label="Sammanfattning">⭐</span>;
  if (lowerHeaderText.includes("progress") || lowerHeaderText.includes("inbody") || lowerHeaderText.includes("styrka")) return <span className="mr-2 text-xl" role="img" aria-label="Framsteg">💪</span>;
  if (lowerHeaderText.includes("mentalt välbefinnande") || lowerHeaderText.includes("balans")) return <span className="mr-2 text-xl" role="img" aria-label="Mentalt välbefinnande">🧘</span>;
  if (lowerHeaderText.includes("observationer") || lowerHeaderText.includes("pass") || lowerHeaderText.includes("aktiviteter")) return <span className="mr-2 text-xl" role="img" aria-label="Observationer">👀</span>;
  if (lowerHeaderText.includes("särskilda råd")) return <span className="mr-2 text-xl" role="img" aria-label="Särskilda råd">ℹ️</span>;

  return <span className="mr-2 text-xl" role="img" aria-label="Rubrik">📄</span>; // Default icon
};

const renderFeedbackContent = (feedback: string | null): JSX.Element[] | null => {
  if (!feedback) return null;

  const lines = feedback.split('\n');
  const renderedElements: JSX.Element[] = [];
  let currentListItems: JSX.Element[] = [];
  let listKeySuffix = 0; // To ensure unique keys for lists if multiple lists appear

  const flushList = () => {
    if (currentListItems.length > 0) {
      renderedElements.push(
        <ul key={`ul-${renderedElements.length}-${listKeySuffix}`} className="list-disc pl-5 space-y-1 my-2">
          {currentListItems}
        </ul>
      );
      currentListItems = [];
      listKeySuffix++;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    let lineContent = lines[i];

    // Basic Markdown to HTML conversion
    lineContent = lineContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    lineContent = lineContent.replace(/\*(?=\S)(.*?)(?<=\S)\*/g, '<em>$1</em>');
    lineContent = lineContent.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-flexibel hover:underline font-semibold">$1</a>');


    if (lineContent.startsWith('## ')) {
      flushList();
      const headerText = lineContent.substring(3).trim();
      const icon = getIconForHeader(headerText.replace(/<\/?(strong|em)>/g, ''));
      renderedElements.push(
        <h4 key={`h4-${i}`} className="text-xl font-bold text-gray-800 flex items-center mb-2 mt-4">
          {icon} <span dangerouslySetInnerHTML={{ __html: headerText }} />
        </h4>
      );
    } else if (lineContent.startsWith('### ')) {
      flushList();
      const headerText = lineContent.substring(4).trim();
      const icon = getIconForHeader(headerText.replace(/<\/?(strong|em)>/g, ''));
      renderedElements.push(
        <h5 key={`h5-${i}`} className="text-lg font-bold text-gray-700 flex items-center mb-1 mt-3">
          {icon} <span dangerouslySetInnerHTML={{ __html: headerText }} />
        </h5>
      );
    } else if (lineContent.startsWith('* ') || lineContent.startsWith('- ')) {
      const listItemText = lineContent.substring(2).trim();
      currentListItems.push(
        <li key={`li-${i}`} className="text-base text-gray-700" dangerouslySetInnerHTML={{ __html: listItemText }} />
      );
    } else {
      flushList(); // End any ongoing list
      if (lineContent.trim() === '') {
        // Add a visual break for empty lines, if not preceded by another break or list.
        if (renderedElements.length > 0) {
          const lastElement = renderedElements[renderedElements.length - 1];
          if (!(lastElement.type === 'div' && lastElement.props.className?.includes('h-2')) && lastElement.type !== 'ul') {
            renderedElements.push(<div key={`br-${i}`} className="h-2"></div>);
          }
        }
      } else {
        renderedElements.push(
          <p key={`p-${i}`} className="text-base text-gray-700 mb-2" dangerouslySetInnerHTML={{ __html: lineContent }} />
        );
      }
    }
  }
  flushList(); // Ensure any trailing list is rendered

  return renderedElements;
};


export const AIProgressFeedbackModal: React.FC<AIProgressFeedbackModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  aiFeedback, // Raw Markdown feedback
  error,
  modalTitle, // Use the new prop
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle || "Feedback"} size="xl">
      <div className="space-y-4 min-h-[200px] max-h-[70vh] flex flex-col">
        {isLoading && (
          <div className="text-center py-8 flex flex-col items-center justify-center flex-grow">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-t-2 border-flexibel mx-auto mb-3"></div>
            <p className="text-lg text-gray-600">Coachen analyserar & ger feedback...</p>
            <p className="text-base text-gray-500">Detta kan ta en liten stund.</p>
          </div>
        )}
        {error && !isLoading && (
           <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex-grow flex flex-col justify-center items-center">
            <p className="font-semibold text-xl">Ett fel uppstod</p>
            <p className="mt-1 text-base">{error}</p>
          </div>
        )}
        {aiFeedback && !isLoading && !error && (
          <div className="overflow-y-auto flex-grow p-1 pr-2">
            <div className="bg-gray-50 rounded-md text-gray-800 leading-relaxed">
              {renderFeedbackContent(aiFeedback)}
            </div>
          </div>
        )}
        <div className="flex justify-end pt-4 border-t mt-auto">
          <Button onClick={onClose} variant="secondary">
            Stäng
          </Button>
        </div>
      </div>
    </Modal>
  );
};