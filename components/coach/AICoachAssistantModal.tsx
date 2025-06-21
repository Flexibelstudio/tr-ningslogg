
import React, { useState, useCallback } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { Button } from '../Button';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { LiftType } from '../../types'; 
import { ALL_LIFT_TYPES } from '../../constants'; 
import { stripMarkdown } from '../../utils/textUtils'; // Import the new utility

interface AICoachAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  ai: GoogleGenAI;
  onSaveSuggestedWorkoutAsDraft: (draft: { title: string; exercisesData: Array<{ name: string; notes: string; baseLiftType?: LiftType }> }) => void;
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

Baserat på detta, generera ett detaljerat förslag till ett träningspass eller en serie av pass som är lämpligt. Förslaget bör inkludera:
1. En passande övergripande titel för programmet/passet (formaterad som en H2 Markdown-rubrik, t.ex. ## Titel på Passet).
2. Om det är ett program över tid, en struktur för hur passen kan fördelas (t.ex. Dag 1: Överkropp, Dag 2: Underkropp, Dag 3: Helkropp).
3. För varje unikt passförslag:
    a. En tydlig lista med övningar, där varje listpunkt börjar med övningens namn (t.ex. * Knäböj, - Bänkpress).
    b. Direkt efter övningens namn, använd ett kolon (t.ex. "Knäböj: ...") eller ett tydligt bindestreck med mellanslag (t.ex. "Bänkpress - ...") följt av detaljerna. Dessa detaljer utgör "anteckningarna" för övningen och bör inkludera:
        i. Ett konkret förslag på antal set och repetitioner (t.ex. 3 set x 8-12 reps, AMRAP 10 minuter).
        ii. Eventuell rekommenderad vila mellan set.
        iii. Korta, värdefulla anteckningar eller fokuspunkter (t.ex. "fokus på explosivitet", "kontrollerad negativ fas").
    c. Om övningen tydligt är en variant av ett av de tillgängliga baslyften/kategorierna (se listan ovan), inkludera en tagg i formatet (Baslyft: NamnPåBaslyft), t.ex. * Frontböj: 3 set x 8 reps (Baslyft: Frontböj). Använd exakt stavning från listan av tillgängliga baslyft.
4. En kort motivering (1-2 meningar) till varför det föreslagna upplägget är lämpligt givet coachens specifikationer.
5. Om det är ett program över flera veckor, inkludera gärna förslag på hur progression kan se ut (t.ex. öka vikt, reps, eller minska vila).

Formatera hela svaret med Markdown för bästa läsbarhet (använd rubriker ##, ###, punktlistor *, -, och fetstil **text**).
Var noggrann och ge konkreta, användbara förslag som coachen kan bygga vidare på. Undvik generiska fraser.
Om någon information från coachen är oklar, gör ett rimligt antagande och nämn detta, eller be om förtydligande i din introduktion.`;

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
      const cleanText = stripMarkdown(generatedSuggestion);
      navigator.clipboard.writeText(cleanText)
        .then(() => alert("Rensat programförslag kopierat till urklipp!"))
        .catch(err => console.error("Kunde inte kopiera text: ", err));
    }
  };

  const handleSaveSuggestionAsWorkout = () => {
    if (!generatedSuggestion) return;

    let workoutTitle = "AI-genererat Passutkast"; 
    const titleRegex = /^(?:#|##|###)\s*(.*)/m; 
    const firstLine = generatedSuggestion.split('\n')[0];
    const titleMatch = firstLine.match(titleRegex);

    if (titleMatch && titleMatch[1]) {
        workoutTitle = titleMatch[1].trim();
    } else {
        const linesForTitle = generatedSuggestion.split('\n');
        for (const line of linesForTitle) {
            if (line.trim().length > 0 && !line.trim().match(/^(\*|-|\d+\.\s)/)) {
                workoutTitle = line.trim().replace(/^(#+\s*)+/, ''); 
                if (workoutTitle.length > 50) workoutTitle = "AI-genererat Passutkast"; 
                break;
            }
        }
    }

    const exercisesData: Array<{ name: string; notes: string; baseLiftType?: LiftType }> = [];
    const lines = generatedSuggestion.split('\n');
    const exerciseItemRegex = /^\s*(?:\d+\.(?!\d)|[*-])\s+(.+)/; 
    const baseLiftRegex = /\(Baslyft:\s*([a-zA-ZåäöÅÄÖ\s\/&]+?)\s*\)/i;


    for (const line of lines) {
        const itemMatch = line.match(exerciseItemRegex);
        if (itemMatch && itemMatch[1]) {
            let fullExerciseText = itemMatch[1].trim();
            let name = fullExerciseText;
            let notes = '';
            let baseLiftType: LiftType | undefined = undefined;

            const baseLiftMatch = fullExerciseText.match(baseLiftRegex);
            if (baseLiftMatch && baseLiftMatch[1]) {
                const potentialBaseLift = baseLiftMatch[1].trim() as LiftType;
                if (ALL_LIFT_TYPES.find(lift => lift.toLowerCase() === potentialBaseLift.toLowerCase())) {
                    baseLiftType = ALL_LIFT_TYPES.find(lift => lift.toLowerCase() === potentialBaseLift.toLowerCase());
                }
                fullExerciseText = fullExerciseText.replace(baseLiftRegex, '').trim(); 
            }
            
            const delimiters = [" - ", ": "];
            let splitSuccessful = false;
            for (const delimiter of delimiters) {
                const parts = fullExerciseText.split(new RegExp(delimiter.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), "m"), 2);
                if (parts.length > 1 && parts[0].trim().length > 0) {
                    name = parts[0].trim();
                    notes = parts[1].trim();
                    splitSuccessful = true;
                    break;
                }
            }

            if (!splitSuccessful) {
                const notesPatternRegex = /(\d+\s*sets?(\s*[xX]\s*\d+(-\d+)?)?\s*reps?|\d+-\d+\s*reps?|\d+\s*reps?|\d+\s*[xX]\s*\d+(-\d+)?\b|\bAMRAP\b.*?|\d+\s*minuter)/i;
                const notesMatch = fullExerciseText.match(notesPatternRegex);

                if (notesMatch && notesMatch.index !== undefined) {
                    const potentialName = fullExerciseText.substring(0, notesMatch.index).trim();
                    if (potentialName.length > 0 && potentialName.length < 70 && !potentialName.match(/^[:\-,.]*$/) && potentialName.toLowerCase() !== "övning") {
                        name = potentialName;
                        notes = fullExerciseText.substring(notesMatch.index).trim();
                    } else { 
                        if (notesMatch[0].length > 10) { 
                           name = notesMatch[0]; 
                           notes = fullExerciseText.substring(notesMatch.index + notesMatch[0].length).trim(); 
                        } else { 
                           name = fullExerciseText; 
                           notes = '';
                        }
                   }
                } else {
                    name = fullExerciseText;
                    notes = '';
                }
            }
            
            if (name.length > 2 && name.split(' ').length < 15 && !/^(dag|vecka|övningar|pass\s*\d*|motivering|progression|struktur|titel):?/i.test(name.toLowerCase())) {
                 exercisesData.push({ name, notes, baseLiftType });
            }
        }
    }

    if (exercisesData.length === 0) {
        alert("Kunde inte extrahera några övningar från AI-förslaget. Du kan kopiera texten och skapa passet manuellt.");
        return;
    }

    onSaveSuggestedWorkoutAsDraft({ title: workoutTitle, exercisesData });
    alert(`Passutkastet "${workoutTitle}" har skapats med ${exercisesData.length} övning(ar). Du kan nu justera och publicera det.`);
    resetInternalState();
    onClose();
  };
  
  const handleClose = () => {
    resetInternalState();
    onClose();
  }

  const cleanSuggestionForDisplay = generatedSuggestion ? stripMarkdown(generatedSuggestion) : null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="AI Assistent" size="xl">
      <div className="space-y-6">
        <p className="text-base text-gray-600">Beskriv önskemål, AI:n ger utkast.</p>
        
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

        {cleanSuggestionForDisplay && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex justify-between items-center">
                <h4 className="text-xl font-semibold text-flexibel">AI Förslag:</h4>
                <div className="flex space-x-2">
                    <Button onClick={handleCopyToClipboard} variant="secondary" size="sm">
                        Kopiera Text
                    </Button>
                    <Button onClick={handleSaveSuggestionAsWorkout} variant="primary" size="sm">
                        Spara Utkast
                    </Button>
                </div>
            </div>
            <div 
              className="p-4 bg-gray-50 rounded-md max-h-[40vh] overflow-y-auto text-base text-gray-800 leading-relaxed"
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
