import React, { useState } from 'react';
import { Workout, WorkoutBlock, Exercise } from '../../types';

// Dragged item shape
interface DragItem {
  type: 'block' | 'exercise';
  index: number;
  blockId?: string;
}

interface WorkoutStructurePanelProps {
  workout: Partial<Pick<Workout, 'blocks'>>;
  focusedBlockId: string | null;
  onBlockClick: (blockId: string) => void;
  onExerciseClick: (exerciseId: string, blockId: string) => void;
  dragItemRef: React.MutableRefObject<DragItem | null>;
  dragOverItemRef: React.MutableRefObject<DragItem | null>;
  onSort: () => void;
}

const DragHandleIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 cursor-grab" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
);

export const WorkoutStructurePanel: React.FC<WorkoutStructurePanelProps> = ({
  workout,
  focusedBlockId,
  onBlockClick,
  onExerciseClick,
  dragItemRef,
  dragOverItemRef,
  onSort,
}) => {
    const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({});

    const toggleBlockCollapse = (blockId: string) => {
        setCollapsedBlocks(prev => ({ ...prev, [blockId]: !prev[blockId] }));
    };

    const handleDragStart = (e: React.DragEvent, item: DragItem) => {
        dragItemRef.current = item;
        e.currentTarget.classList.add('opacity-50');
    };

    const handleDragEnter = (e: React.DragEvent, item: DragItem) => {
        dragOverItemRef.current = item;
    };
    
    const handleDragEnd = (e: React.DragEvent) => {
        onSort();
        e.currentTarget.classList.remove('opacity-50');
        document.querySelectorAll('.dragging-over').forEach(el => el.classList.remove('dragging-over'));
    };
    
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        // Optional: add visual feedback for drop target
        // e.currentTarget.classList.add('dragging-over');
    };


    return (
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg h-full flex flex-col min-h-[500px]">
            <h3 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">Passets Struktur</h3>
            <div className="space-y-3 overflow-y-auto flex-grow pr-2 -mr-2">
                {(workout.blocks || []).map((block, blockIndex) => {
                    const isCollapsed = collapsedBlocks[block.id];
                    const isFocused = focusedBlockId === block.id;
                    const exerciseCount = block.exercises?.length || 0;
                    
                    return (
                        <div key={block.id}
                             className={`bg-white border border-gray-300 rounded-md transition-all duration-200 ${isFocused ? 'ring-2 ring-flexibel' : ''}`}
                             draggable
                             onDragStart={(e) => handleDragStart(e, { type: 'block', index: blockIndex })}
                             onDragEnter={(e) => handleDragEnter(e, { type: 'block', index: blockIndex })}
                             onDragEnd={handleDragEnd}
                             onDragOver={handleDragOver}
                        >
                            {/* Block Header */}
                            <div className="p-3 flex items-center justify-between group">
                                <div className="flex items-center gap-2 flex-grow min-w-0" onClick={() => onBlockClick(block.id)} >
                                    <DragHandleIcon />
                                    <div className="flex-grow min-w-0">
                                        <p className="font-bold text-gray-800 truncate pr-2 cursor-pointer">{block.name || `Block ${blockIndex + 1}`}</p>
                                        <p className="text-sm text-gray-500 cursor-pointer">{exerciseCount} övning(ar)</p>
                                    </div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); toggleBlockCollapse(block.id); }} className="p-1 rounded-full hover:bg-gray-200 flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-600 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                            
                            {/* Exercises List (if not collapsed) */}
                            {!isCollapsed && (
                                <ul className="pb-2 pl-4 pr-2 space-y-1 animate-fade-in-down">
                                    {(block.exercises || []).map((exercise, exerciseIndex) => (
                                        <li key={exercise.id}
                                            className="p-2 text-gray-700 flex items-center gap-2 rounded-md hover:bg-gray-100"
                                            draggable
                                            onClick={(e) => { e.stopPropagation(); onExerciseClick(exercise.id, block.id); }}
                                            onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, { type: 'exercise', index: exerciseIndex, blockId: block.id }); }}
                                            onDragEnter={(e) => { e.stopPropagation(); handleDragEnter(e, { type: 'exercise', index: exerciseIndex, blockId: block.id }); }}
                                            onDragEnd={(e) => { e.stopPropagation(); handleDragEnd(e); }}
                                            onDragOver={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                        >
                                            <DragHandleIcon />
                                            <span className="cursor-pointer">{exercise.name}</span>
                                        </li>
                                    ))}
                                    {exerciseCount === 0 && (
                                        <li className="px-2 py-1 text-sm text-gray-500 italic">Inga övningar</li>
                                    )}
                                </ul>
                            )}
                        </div>
                    );
                })}
                 {(workout.blocks || []).length === 0 && (
                    <div className="text-center py-8 text-gray-500 italic">
                        Lägg till ett block för att börja bygga passet.
                    </div>
                 )}
            </div>
        </div>
    );
};