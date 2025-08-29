import React, { useState } from 'react';
import { Button } from '../Button';

// SVG Icons for a more professional look
const GoalIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5l-7.5 7.5-3.5-3.5" /></svg>;
const FlowIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const CommunityIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const AiReceptIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>;

interface FixedHeaderAndToolsProps {
  onOpenGoalModal: () => void;
  onOpenCommunity: () => void;
  onOpenAiRecept: () => void;
  onOpenFlowModal: () => void;
  aiRecept?: string | null;
  newFlowItemsCount: number;
  pendingRequestsCount: number;
}

export const FixedHeaderAndTools: React.FC<FixedHeaderAndToolsProps> = ({
  onOpenGoalModal,
  onOpenCommunity,
  aiRecept,
  onOpenAiRecept,
  newFlowItemsCount,
  pendingRequestsCount,
  onOpenFlowModal
}) => {
  return (
    <div className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-2 py-1 flex justify-around items-center">
           <Button
            onClick={onOpenGoalModal}
            variant='ghost'
            size="sm"
            className="flex items-center justify-center h-auto p-2 text-flexibel"
            title="Mål & Plan"
            aria-label="Mål & Plan"
          >
            <GoalIcon />
          </Button>
          {aiRecept && (
            <Button
              onClick={onOpenAiRecept}
              variant='ghost'
              size="sm"
              className="flex items-center justify-center h-auto p-2 text-flexibel"
              title="Coachens tips för att du ska nå ditt mål"
              aria-label="Coachens tips för att du ska nå ditt mål"
            >
              <AiReceptIcon />
            </Button>
          )}
          <Button
            onClick={onOpenFlowModal}
            variant='ghost'
            size="sm"
            className="relative flex items-center justify-center h-auto p-2 text-flexibel"
            title="Flöde"
            aria-label="Flöde"
          >
              <FlowIcon />
              {newFlowItemsCount > 0 && (
                  <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {newFlowItemsCount}
                  </span>
              )}
          </Button>
         <Button
            onClick={onOpenCommunity}
            variant='ghost'
            size="sm"
            className="relative flex items-center justify-center h-auto p-2 text-flexibel"
            title="Community"
            aria-label="Community"
          >
            <CommunityIcon />
            {pendingRequestsCount > 0 && (
                <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {pendingRequestsCount}
                </span>
            )}
          </Button>
      </div>
    </div>
  );
};
