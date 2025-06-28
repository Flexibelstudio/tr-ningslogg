
import React, { useState, useCallback } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { Button } from '../Button';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { LiftType } from '../../types';
import { ALL_LIFT_TYPES } from '../../constants';
import { stripMarkdown } from '../../utils/textUtils';

interface AICoachAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  ai: GoogleGenAI;
  onSaveSuggestedWorkoutAsDraft: (draft: { title: string; blocksData: Array<{ name?: string; exercises: Array<{ name: string; notes: string; baseLiftType?: LiftType }> }> }) => void;
}

interface FormData {
  targetAudience: string;
  programDurationFrequency: string;
  mainGoals: string;
  specificRequestsOrAvoidances: string;
}

export const AICoachAssistantModal: React.FC<AICoachAssistantModalProps> = ({ isOpen, onClose, ai, onSaveSuggestedWorkoutAsDraft }) => {
  const [formData, setFormData] = useState<FormData>({
    targetAudience: '',
    programDurationFrequency: '',
    mainGoals: '',
    specificRequestsOrAvoidances: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedSuggestion, setGeneratedSuggestion] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const resetInternalState = () => {
    setFormData({
        targetAudience: '',
        programDurationFrequency: '',
        mainGoals: '',
        specificRequestsOrAvoidances: '',
    });
    setGeneratedSuggestion(null);
    setError(null);
    setIsLoading(false);
  };

  const handleGenerateSuggestion = useCallback(async () => {
    if (!formData.targetAudience && !formData.programDurationFrequency && !formData.mainGoals) {
        setError("Vänligen ange åtminstone målgrupp, varaktighet/frekvens eller mål för att få ett bra förslag.");
        return;
    }
    
    setIsLoading(true);
    setError(null);
    setGeneratedSuggestion(null);

    const availableBaseLiftsString = ALL_LIFT_TYPES.join(', ');

    const prompt = `Du är en expert AI-assistent för träningscoacher på Flexibel Hälsostudio. Din uppgift är att hjälpa coachen att skapa genomtänkta och strukturerade träningspass eller programförslag.

Coachen har specificerat följande önskemål för ett träningsupplägg:
- Målgrupp: "${formData.targetAudience || 'Ej specificerat'}"
- Programlängd/Frekvens: "${formData.programDurationFrequency || 'Ej specificerat'}"
- Huvudsakliga mål: "${formData.mainGoals || 'Ej specificerat'}"
- Specifika önskemål eller saker att undvika: "${formData.specificRequestsOrAvoidances || 'Inga specifika'}"

Tillgängliga baslyft/kategorier som övningar kan kopplas till är: ${availableBaseLiftsString}.

Strukturera ditt svar i TVÅ HUVUDDELAR:
1.  **## Workout Arrangement**
    *   Detta är en kort översikt.
    *   Använd H3-rubriker för varje block (t.ex. ### Block A - Överkropp). Inkludera gärna antalet övningar i blocket i rubriken (t.ex. (2 övningar)).
    *   Under varje blockrubrik, lista ENDAST namnen på övningarna som punktlista (t.ex. * Hantelpress på bänk).

2.  **## Detailed Program**
    *   Detta är den detaljerade beskrivningen av varje block och dess övningar.
    *   Använd H3-rubriker för varje block (t.ex. ### Block A - Överkropp).
    *   Under H3-rubriken kan du lägga till en kort beskrivning/anteckning för blocket om det är relevant (1-2 meningar).
    *   Lista sedan övningarna inom blocket som punktlistor (t.ex. * Knäböj).
    *   För VARJE övning, direkt efter namnet, använd ett kolon (":") eller ett bindestreck med mellanslag (" - ") följt av detaljerna. Dessa detaljer utgör "anteckningarna" för övningen och BÖR inkludera:
        *   Förslag på antal set och repetitioner (t.ex. 3 set x 8-12 reps, AMRAP 10 minuter).
        *   Eventuell rekommenderad vila mellan set.
        *   Korta, värdefulla anteckningar eller fokuspunkter (t.ex. "fokus på explosivitet", "kontrollerad negativ fas").
    *   Om övningen tydligt är en variant av ett av de tillgängliga baslyften/kategorierna, inkludera en tagg i formatet (Baslyft: NamnPåBaslyft), t.ex. * Frontböj: 3 set x 8 reps (Baslyft: Frontböj). Använd exakt stavning från listan av tillgängliga baslyft.

Exempel på "Detailed Program" struktur för ett block:
### Block A - Styrka Fokus
Detta block fokuserar på tunga baslyft för överkropp.

*   Bänkpress: 3 set x 5-8 reps, vila 90 sek. Fokus på kontrollerad sänkning. (Baslyft: Bänkpress)
*   Hantelrodd: 3 set x 8-12 reps per sida, vila 60 sek. Dra armbågen bakåt, kläm ihop skulderbladen. (Baslyft: Hantelrodd)

Övriga instruktioner:
*   Om det är ett program över tid, beskriv strukturen (t.ex. Dag 1, Dag 2) inom "Detailed Program", där varje dag kan innehålla ett eller flera block.
*   Ge en kort motivering (1-2 meningar) till varför det föreslagna upplägget är lämpligt, detta kan placeras i början av "Detailed Program" eller efter "Workout Arrangement".
*   Om det är ett program över flera veckor, inkludera gärna förslag på progression.

Formatera hela svaret med Markdown. Var noggrann och ge konkreta, användbara förslag.
Om någon information från coachen är oklar, gör ett rimligt antagande och nämn detta, eller be om förtydligande i din introduktion (innan Workout Arrangement).`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
      });
      setGeneratedSuggestion(response.text);
    } catch (err) {
      console.error("Error fetching AI coach suggestion:", err);
      setError("Kunde inte generera förslag från AI. Försök igen senare eller kontrollera din API-nyckel.");
    } finally {
      setIsLoading(false);
    }
  }, [ai, formData]);

  const handleCopyToClipboard = () => {
    if (generatedSuggestion) {
      const cleanText = stripMarkdown(generatedSuggestion); // Displayed text remains stripped
      navigator.clipboard.writeText(cleanText)
        .then(() => alert("Rensat programförslag kopierat till urklipp!"))
        .catch(err => console.error("Kunde inte kopiera text: ", err));
    }
  };

  const parseAndSaveSuggestion = () => {
    if (!generatedSuggestion) return;

    let workoutTitle = "AI-genererat Passutkast";
    const lines = generatedSuggestion.split('\n');
    
    // Attempt to find a title from H1 or H2, avoiding section titles
    const titleRegexH1H2 = /^(?:#|##)\s*(.*)/;
    for (const line of lines) {
        const match = line.match(titleRegexH1H2);
        if (match && match[1]) {
            const potentialTitle = match[1].trim();
            if (!potentialTitle.toLowerCase().includes("workout arrangement") && !potentialTitle.toLowerCase().includes("detailed program")) {
                workoutTitle = potentialTitle;
                break;
            }
        }
    }
    // Fallback if no suitable H1/H2 found, or if they were section titles
    if (workoutTitle === "AI-genererat Passutkast" || workoutTitle.toLowerCase().includes("workout arrangement") || workoutTitle.toLowerCase().includes("detailed program")) {
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.length > 0 && !trimmedLine.match(/^(#|##|###|\*|-)/) && !trimmedLine.toLowerCase().includes("workout arrangement") && !trimmedLine.toLowerCase().includes("detailed program")) {
                workoutTitle = trimmedLine.substring(0, 80); // Cap length
                if (workoutTitle.length === 0) workoutTitle = "AI-genererat Passutkast";
                break;
            }
        }
    }


    const blocksData: Array<{ name?: string; exercises: Array<{ name: string; notes: string; baseLiftType?: LiftType }> }> = [];
    let currentBlock: { name?: string; exercises: Array<{ name: string; notes: string; baseLiftType?: LiftType }> } | null = null;
    let inDetailedProgramSection = false;

    const blockHeadingRegex = /^###\s*(.*)/;
    const exerciseItemRegex = /^\s*[*-]\s+(.+)/;
    const baseLiftRegex = /\(Baslyft:\s*([a-zA-ZåäöÅÄÖ\s\/&'’]+?)\s*\)/i;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.toLowerCase().startsWith("## detailed program")) {
            inDetailedProgramSection = true;
            continue;
        }
        if (trimmedLine.toLowerCase().startsWith("## workout arrangement")) {
            if (inDetailedProgramSection && currentBlock) { // Save the last block from Detailed Program
                blocksData.push(currentBlock);
                currentBlock = null;
            }
            inDetailedProgramSection = false; // Stop processing for blocks
            continue;
        }

        if (!inDetailedProgramSection) continue;

        const blockMatch = trimmedLine.match(blockHeadingRegex);
        if (blockMatch && blockMatch[1]) {
            if (currentBlock) {
                blocksData.push(currentBlock);
            }
            let blockName = blockMatch[1].trim();
            blockName = blockName.replace(/\(\d+\s*(övning(ar)?|exercise[s]?)\s*\)/i, "").trim();
            currentBlock = { name: blockName || undefined, exercises: [] };
            // Note: Block descriptions are not parsed into a specific field in blocksData for now.
            continue;
        }

        if (currentBlock) {
            const exerciseMatch = trimmedLine.match(exerciseItemRegex);
            if (exerciseMatch && exerciseMatch[1]) {
                let fullExerciseText = exerciseMatch[1].trim();
                let exerciseName = fullExerciseText;
                let exerciseNotes = '';
                let baseLiftType: LiftType | undefined = undefined;

                const baseLiftNameMatch = fullExerciseText.match(baseLiftRegex);
                if (baseLiftNameMatch && baseLiftNameMatch[1]) {
                    const potentialBaseLift = baseLiftNameMatch[1].trim();
                    baseLiftType = ALL_LIFT_TYPES.find(lift => lift.toLowerCase() === potentialBaseLift.toLowerCase()) || undefined;
                    fullExerciseText = fullExerciseText.replace(baseLiftRegex, '').trim();
                }

                const delimiters = [": ", " - "];
                let splitSuccessful = false;
                for (const delimiter of delimiters) {
                    const parts = fullExerciseText.split(delimiter);
                    if (parts.length > 1 && parts[0].trim().length > 0) {
                        exerciseName = parts[0].trim();
                        exerciseNotes = parts.slice(1).join(delimiter).trim();
                        splitSuccessful = true;
                        break;
                    }
                }
                if (!splitSuccessful) {
                    const notesPatternRegex = /(\d+\s*set|\d+-\d+\s*rep|\bAMRAP\b|\d+\s*min|vila\s*\d+)/i;
                    const notesMatchIndex = fullExerciseText.search(notesPatternRegex);

                    if (notesMatchIndex > 0 && notesMatchIndex > Math.min(20, fullExerciseText.length / 3)) {
                        exerciseName = fullExerciseText.substring(0, notesMatchIndex).trim();
                        exerciseNotes = fullExerciseText.substring(notesMatchIndex).trim();
                    } else if (fullExerciseText.length > 60 && notesMatchIndex !== -1) {
                        exerciseName = "Övning"; 
                        exerciseNotes = fullExerciseText;
                    } else {
                        exerciseName = fullExerciseText;
                        exerciseNotes = "";
                    }
                }
                
                if (exerciseName.length > 1 && exerciseName.length < 150 && !/^(detta block|fokusera på|programmet är|vila|kommentar|beskrivning|anteckning för blocket)/i.test(exerciseName.toLowerCase())) {
                    currentBlock.exercises.push({ name: exerciseName, notes: exerciseNotes, baseLiftType });
                }
            }
        }
    }

    if (currentBlock) {
        blocksData.push(currentBlock);
    }
    
    if (blocksData.length === 0 && generatedSuggestion.includes("*")) {
        console.warn("Block parsing might have failed or yielded no blocks; check AI response if draft is empty/flat.");
    }
    
    onSaveSuggestedWorkoutAsDraft({ title: workoutTitle, blocksData });
    alert(`Passutkastet "${workoutTitle}" har skapats ${blocksData.length > 0 ? `med ${blocksData.length} block och totalt ${blocksData.reduce((sum, b) => sum + b.exercises.length, 0)} övningar` : ' (kan vara tomt eller ofullständigt, kontrollera AI-svar)'}. Du kan nu justera och publicera det.`);
    resetInternalState();
    onClose();
  };
  
  const handleClose = () => {
    resetInternalState();
    onClose();
  }

  const cleanSuggestionForDisplay = generatedSuggestion ? generatedSuggestion : null; // Show raw Markdown with structure

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="AI Assistent - Skapa Pass" size="xl">
      <div className="space-y-6">
        <p className="text-base text-gray-600">Beskriv önskemål, AI:n ger utkast strukturerat i block.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Målgrupp"
            name="targetAudience"
            value={formData.targetAudience}
            onChange={handleChange}
            placeholder="T.ex. Nybörjare, Seniorer, Styrkelyftare"
          />
          <Input
            label="Programlängd / Frekvens"
            name="programDurationFrequency"
            value={formData.programDurationFrequency}
            onChange={handleChange}
            placeholder="T.ex. 4 veckor, 3 pass/vecka; Ett enstaka pass"
          />
        </div>
        <Input
            label="Huvudsakliga Mål"
            name="mainGoals"
            value={formData.mainGoals}
            onChange={handleChange}
            placeholder="T.ex. Öka muskelmassa, Förbättra kondition, Viktnedgång"
        />
        <Textarea
          label="Specifika Önskemål / Att Undvika"
          name="specificRequestsOrAvoidances"
          value={formData.specificRequestsOrAvoidances}
          onChange={handleChange}
          placeholder="T.ex. Inkludera marklyft, undvik hopp, max 60 min/pass"
          rows={3}
        />

        <Button onClick={handleGenerateSuggestion} disabled={isLoading} fullWidth variant="primary">
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Genererar förslag...
            </div>
          ) : "Generera Förslag"}
        </Button>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            <p className="font-semibold">Fel:</p>
            <p>{error}</p>
          </div>
        )}

        {generatedSuggestion && ( // Display raw Markdown
          <div className="space-y-3 pt-4 border-t">
            <div className="flex justify-between items-center">
                <h4 className="text-xl font-semibold text-flexibel">AI Förslag:</h4>
                <div className="flex space-x-2">
                    <Button onClick={handleCopyToClipboard} variant="secondary" size="sm">
                        Kopiera Text (Rensad)
                    </Button>
                    <Button onClick={parseAndSaveSuggestion} variant="primary" size="sm">
                        Spara Utkast
                    </Button>
                </div>
            </div>
            <div
              className="p-4 bg-gray-50 rounded-md max-h-[40vh] overflow-y-auto text-sm text-gray-800 leading-relaxed prose prose-sm max-w-none"
              style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}
            >
              {cleanSuggestionForDisplay}
            </div>
          </div>
        )}
         <div className="flex justify-end space-x-3 pt-6 border-t">
          <Button onClick={handleClose} variant="secondary">Stäng</Button>
        </div>
      </div>
    </Modal>
  );
};
