import React, { useState, useRef, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { renderMarkdown } from '../utils/textUtils';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  isBlocking?: boolean;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose, onAccept, isBlocking = false }) => {
  const [canAccept, setCanAccept] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = contentRef.current;
    if (el) {
      // Check if user has scrolled to within 5 pixels of the bottom
      if (el.scrollHeight - el.scrollTop <= el.clientHeight + 5) {
        setCanAccept(true);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
        // Reset state when modal opens
        setCanAccept(false); 
        // Use a timeout to allow the modal and its content to render fully before checking scroll height
        setTimeout(() => {
            const el = contentRef.current;
            if (el) {
                el.scrollTop = 0; // Ensure scroll is at the top
                // If content is not scrollable, user can accept immediately
                if (el.scrollHeight <= el.clientHeight) {
                    setCanAccept(true);
                }
            }
        }, 100);
    }
  }, [isOpen]);

  const termsText = `
### Användarvillkor för Träningsloggen
*Senast uppdaterad: 2024-09-16*

**1. Inledning**
Välkommen till Träningsloggen ("Tjänsten"), en applikation från Flexibel Hälsostudio. Genom att registrera ett konto och använda Tjänsten godkänner du dessa användarvillkor.

**2. Användning av Tjänsten**
Du ansvarar för att informationen du anger är korrekt och för att hålla dina inloggningsuppgifter hemliga. Tjänsten får endast användas för personligt, icke-kommersiellt bruk i enlighet med dess avsedda syfte. All form av missbruk, försök till dataintrång eller spridning av skadlig kod är förbjudet.

**3. Innehåll och Immateriella Rättigheter**
Allt innehåll du skapar i Tjänsten (t.ex. träningsloggar, kommentarer, mål) tillhör dig. Du ger oss rätten att lagra, visa och bearbeta detta innehåll för att tillhandahålla Tjänstens funktioner. Allt övrigt material, inklusive design, text, grafik och logotyper, tillhör Flexibel Hälsostudio.

**4. Ansvarsbegränsning**
Tjänsten tillhandahålls i befintligt skick. Vi strävar efter att den ska vara tillgänglig och korrekt, men vi kan inte garantera att den är fri från fel eller avbrott.
*   **AI-Coachen:** Funktioner som använder Artificiell Intelligens (AI) är avsedda som ett stöd- och inspirationsverktyg. Råden som ges är genererade automatiskt och ska inte ses som medicinsk eller professionell personlig tränarrådgivning. Konsultera alltid en mänsklig coach eller medicinsk expert vid osäkerhet kring din hälsa eller träning.
*   All träning sker på egen risk. Flexibel Hälsostudio ansvarar inte för skador som kan uppstå i samband med användning av Tjänsten.

**5. Ändringar i villkoren**
Vi kan komma att uppdatera dessa villkor. Vid väsentliga ändringar kommer du att meddelas och behöva godkänna de nya villkoren för att fortsätta använda Tjänsten.

**6. Kontakt**
Vid frågor om dessa villkor, vänligen kontakta din coach på Flexibel Hälsostudio.
  `;

  const privacyText = `
### Integritetspolicy för Träningsloggen
*Senast uppdaterad: 2024-09-16*

**1. Personuppgiftsansvarig**
Flexibel Hälsostudio [Org.nr] är personuppgiftsansvarig för behandlingen av dina personuppgifter i Tjänsten.

**2. Vilka uppgifter samlar vi in?**
Vi samlar in uppgifter som du själv lämnar till oss:
*   **Kontakt- och kontouppgifter:** Namn, e-postadress.
*   **Profiluppgifter:** Ålder, kön, kroppsvikt, och andra mått du väljer att ange.
*   **Träningsdata:** Loggade träningspass, övningar, set, reps, vikt, kommentarer och humörbetyg.
*   **Målsättningar:** Dina formulerade träningsmål och preferenser.
*   **Interaktionsdata:** Kommentarer och reaktioner du lämnar på andras eller dina egna inlägg i community-flödet.
*   **Teknisk data:** Anonymiserad data om hur du använder appen för att förbättra Tjänsten.

**3. Varför samlar vi in uppgifterna? (Ändamål och Rättslig grund)**
Dina uppgifter behandlas för att:
*   **Tillhandahålla Tjänsten:** Skapa och hantera ditt konto, samt möjliggöra loggning och uppföljning av din träning. (Rättslig grund: Fullgörande av avtal).
*   **Personalisera din upplevelse:** Ge dig statistik, beräkna styrkenivåer (FSS), visa relevanta topplistor och ge AI-genererade tips och feedback. (Rättslig grund: Fullgörande av avtal och intresseavvägning).
*   **Möjliggöra coachning:** Ge din coach underlag för att kunna ge dig bättre personlig träning och uppföljning. (Rättslig grund: Fullgörande av avtal).
*   **Social interaktion:** Visa dina aktiviteter för vänner i community-flödet (om du aktiverat detta) och hantera kommentarer/reaktioner. (Rättslig grund: Fullgörande av avtal).
*   **Förbättra Tjänsten:** Analysera användarmönster för att felsöka och utveckla nya funktioner. (Rättslig grund: Intresseavvägning).

**4. Hur länge sparas uppgifterna?**
Dina personuppgifter sparas så länge du har ett aktivt konto i Tjänsten. Om du avslutar ditt konto raderas dina uppgifter inom 90 dagar.

**5. Delning av uppgifter**
Dina uppgifter delas endast med:
*   **Coacher och personal:** På den Flexibel Hälsostudio-anläggning du tillhör, för att de ska kunna utföra sitt arbete.
*   **Andra medlemmar:** Om du väljer att delta i community-funktioner som topplistor eller vänlistor, kommer ditt namn och dina resultat vara synliga för andra medlemmar i enlighet med dina profilinställningar.
Vi säljer aldrig dina personuppgifter till tredje part.

**6. Dina rättigheter**
Du har rätt att:
*   Begära tillgång till dina personuppgifter (registerutdrag).
*   Begära rättelse av felaktiga uppgifter.
*   Begära radering av dina uppgifter.
*   Invända mot behandling som stödjer sig på intresseavvägning.
*   Begära dataportabilitet.
Om du vill utöva dina rättigheter, kontakta oss. Du har även rätt att lämna in klagomål till Integritetsskyddsmyndigheten (IMY).

**7. Säkerhet**
Vi vidtar lämpliga tekniska och organisatoriska åtgärder för att skydda dina uppgifter mot obehörig åtkomst och förlust.

**8. Kontakt**
För frågor gällande denna policy eller dina personuppgifter, kontakta din coach på Flexibel Hälsostudio.
  `;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={isBlocking ? () => {} : onClose} 
      title="Villkor och Integritetspolicy" 
      size="2xl"
    >
      <div className="flex flex-col h-[70vh]">
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="prose max-w-none flex-grow overflow-y-auto pr-4 -mr-4 text-gray-700"
          aria-label="Villkorstext"
        >
          {renderMarkdown(termsText)}
          <hr className="my-6" />
          {renderMarkdown(privacyText)}
        </div>
        
        <div className="flex justify-end pt-4 mt-4 border-t">
          {isBlocking ? (
              <Button onClick={onAccept} disabled={!canAccept} title={!canAccept ? "Scrolla till botten för att godkänna" : "Godkänn villkoren"}>
                Jag har läst och godkänner
              </Button>
          ) : (
            <Button onClick={onClose}>
                Stäng
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};