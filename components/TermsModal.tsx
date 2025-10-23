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
### Användarvillkor för Träningslogg
*Senast uppdaterad: 2025-10-23*

**1. Vem vi är**
Tjänsten Träningsloggen (“Tjänsten”) tillhandahålls av Flexibel Friskvåd & Hälsa Sverige AB, org.nr 559256-8736, Kärra Centrum 7, Hisings Kärra, info@flexibelfriskvardhalsa.se (“Flexibel Hälsostudio”, “vi”).

**2. Avtalets omfattning**
Genom att skapa ett konto eller använda Tjänsten accepterar du dessa villkor. Om du representerar en organisation eller coach intygar du att du har behörighet att ingå avtalet.
Behandlingen av personuppgifter regleras i vår Integritetspolicy, som utgör en del av dessa villkor.

**3. Konto och säkerhet**
Du ansvarar för att de uppgifter du anger är riktiga, för att skydda dina inloggningsuppgifter och för att omedelbart meddela oss vid misstänkt obehörig användning av ditt konto.

**4. Tillåten användning**
Du får använda Tjänsten för personligt bruk i enlighet med dess avsedda syfte. Du får inte:
* kringgå säkerhetsfunktioner, avlyssna eller testa sårbarheter,
* ladda upp eller skicka skadlig kod, kränkande eller olagligt innehåll,
* försöka skrapa, masshämta eller återförsälja Tjänsten.

Vi kan tillfälligt stänga av eller avsluta konton som bryter mot dessa villkor.

**5. Innehåll och licenser**
Ditt innehåll (t.ex. träningsloggar, kommentarer, mål) ägs av dig. Du ger oss en icke-exklusiv licens att lagra, behandla och visa innehållet för att kunna leverera Tjänsten.

Vårt innehåll (programvara, design, varumärken) ägs av oss och licensieras till dig för användning av Tjänsten.

**5a. Användargenererat innehåll och ansvar**
Du ansvarar själv för allt innehåll du lägger in i Tjänsten, inklusive fritext, anteckningar och träningsdata.
Eftersom Tjänsten är avsedd för träningsrelaterad information bör du inte skriva in känsliga personuppgifter (t.ex. sjukdomar, diagnoser, medicinering eller uppgifter om tredje part).
Tjänsten stöder inte uppladdning av filer, bilder eller dokument.
Om du ändå väljer att dela känslig information i fritextfält gör du det på eget ansvar. Vi behandlar endast uppgifterna för att kunna tillhandahålla Tjänsten och enligt vår Integritetspolicy.

Vi kan ta bort eller begränsa innehåll som bryter mot dessa villkor eller tillämplig lag.

**6. AI-funktioner och rådgivning**
AI-funktioner (t.ex. genererade tips eller analyser) tillhandahålls endast som vägledning och utgör inte medicinsk rådgivning eller individuella träningsrekommendationer.
All träning och tillämpning av råd sker på egen risk. Rådfråga läkare eller coach vid osäkerhet.

**7. Tjänstens tillgänglighet**
Tjänsten tillhandahålls “i befintligt skick” utan garanti om avbrottsfri eller felfri drift. Vi kan uppdatera, ändra eller avveckla funktioner. Planerade driftstopp meddelas i rimlig tid.

**8. Ansvarsbegränsning**
I den utsträckning lagen tillåter ansvarar vi inte för indirekta skador, följdskador eller förlust av data som kan uppstå vid användning av Tjänsten.
Tjänsten tillhandahålls i befintligt skick och används på egen risk. Vi lämnar inga garantier om att informationen i Tjänsten är fullständig, korrekt eller alltid tillgänglig.

**9. Uppsägning och avslut av konto**
Du kan när som helst säga upp ditt konto i Träningsloggen genom att maila till mailadressen längst ner.
Om ditt medlemskap hos Flexibel Hälsostudio avslutas kommer även ditt konto i Träningsloggen att avslutas automatiskt direkt efter sista dagen för ditt medlemskap, och din data kommer då att raderas i enlighet med vår Integritetspolicy.

Vid uppsägning eller radering upphör din åtkomst till Tjänsten, och vi kan inte återskapa data efter radering.

**10. Tredje parter**
Tjänsten kan länka till tredje parter eller använda tredjeparts-SDK eller tjänster. Dessa har egna villkor och policys som vi inte ansvarar för.

**11. Ändringar av villkoren**
Vi kan uppdatera villkoren. Väsentliga ändringar meddelas i förväg och kräver ditt godkännande för fortsatt användning.

**12. Tillämplig lag och tvister**
Svensk lag gäller. Tvister prövas av svensk allmän domstol med [ort] tingsrätt som första instans.

**13. Kontakt**
Frågor rörande dessa villkor: info@flexibelfriskvardhalsa.se.
  `;

  const privacyText = `
### Integritetspolicy för Träningslogg
*Senast uppdaterad: 2025-10-23*

**1. Inledning**
Denna integritetspolicy beskriver hur Flexibel Hälsostudio (“vi”) behandlar personuppgifter när du använder Träningsloggen (“Tjänsten”). Vi värnar om din integritet och behandlar endast de uppgifter som behövs för att leverera och förbättra Tjänsten.

Vi följer EU:s dataskyddsförordning (GDPR) och annan tillämplig lagstiftning i Sverige.

**2. Personuppgiftsansvarig**
Flexibel Friskvåd & Hälsa Sverige AB
Org.nr 559256-8736
Kärra Centrum 7, Hisings Kärra
E-post: info@flexibelfriskvardhalsa.se

Vi är personuppgiftsansvariga för behandlingen av dina uppgifter i Träningsloggen.

**3. Vilka personuppgifter vi behandlar**
När du använder Tjänsten behandlar vi följande typer av personuppgifter:

a) Kontouppgifter
* Namn, e-postadress och inloggningsuppgifter
* Eventuellt koppling till ditt medlemskap hos Flexibel Hälsostudio

b) Träningsdata
* Övningar, set, reps, tider, vikter, distanser, mål, anteckningar
* Självrapporterad information om mående, sömn, energi och prestation
* InBody-data eller annan kroppssammansättningsinformation (om du väljer att registrera det manuellt)

c) System- och användningsdata
* Teknisk information som krävs för att Tjänsten ska fungera (t.ex. enhets-ID, webbläsare, felrapporter)
* Anonymiserad statistik för att förbättra stabilitet och användarupplevelse

d) Fritextfält
Tjänsten tillåter fritext, vilket innebär att du själv kan välja vad du skriver. Vi uppmanar dig att inte skriva in känsliga personuppgifter (t.ex. sjukdomar, diagnoser, medicinering eller uppgifter om andra personer).

Tjänsten stöder inte uppladdning av filer, bilder eller dokument.

**4. Varför och hur vi använder uppgifterna**
Vi behandlar dina personuppgifter för att leverera och administrera Tjänsten, visa och spara dina träningsloggar, ge analys och insikter (t.ex. AI-genererade tips), förbättra funktioner, användarupplevelse och stabilitet, hantera supportärenden, och uppfylla rättsliga skyldigheter (t.ex. enligt bokförings- eller konsumentskyddslagstiftning, om tillämpligt).

**5. Rättslig grund för behandlingen**
Behandlingen sker huvudsakligen på följande rättsliga grunder:
* **Avtal:** För att kunna leverera och administrera Tjänsten till dig.
* **Berättigat intresse:** För att förbättra Tjänsten, analysera användning och säkerställa säkerhet.
* **Samtycke:** För den information du frivilligt lägger in i fritextfält eller träningsloggar som kan anses vara hälsorelaterad.

Du kan när som helst återkalla ditt samtycke genom att radera sådan information eller avsluta ditt konto.

**6. Lagringstid och radering**
Vi sparar dina uppgifter så länge du har ett aktivt konto i Träningsloggen.
När ditt medlemskap hos Flexibel Hälsostudio avslutas, avslutas även ditt konto i Träningsloggen automatiskt direkt efter sista dagen för medlemskapet, och all data raderas därefter permanent.

Om du själv väljer att säga upp kontot i förväg raderas dina uppgifter enligt samma rutin.

**7. Delning av uppgifter**
Vi säljer aldrig dina personuppgifter.
Dina uppgifter kan delas med:
* Tekniska driftpartners som tillhandahåller servrar, datalagring och systemunderhåll (enbart i syfte att driva Tjänsten).
* Eventuella underbiträden (t.ex. leverantörer av AI-funktioner eller analysverktyg) som är bundna av personuppgiftsbiträdesavtal enligt GDPR.

Alla uppgifter lagras och behandlas inom EU/EES eller hos leverantörer som uppfyller EU:s dataskyddskrav.

**8. Dina rättigheter**
Du har enligt GDPR rätt att få tillgång till de uppgifter vi behandlar om dig, begära rättelse av felaktiga uppgifter, begära radering (“rätten att bli bortglömd”), invända mot viss behandling, begära begränsning av behandling, begära dataportabilitet, och återkalla eventuellt samtycke.

För att utöva dessa rättigheter kontaktar du oss på info@flexibelfriskvardhalsa.se. Vi svarar inom 30 dagar.

Du har också rätt att lämna klagomål till Integritetsskyddsmyndigheten (IMY) om du anser att vi behandlar dina personuppgifter i strid med lag.

**9. Säkerhet**
Vi använder tekniska och organisatoriska säkerhetsåtgärder för att skydda dina uppgifter mot obehörig åtkomst, förändring, förlust eller spridning. Endast behörig personal har åtkomst till personuppgifter, och all kommunikation krypteras.

**10. AI-funktioner**
AI-funktioner i Tjänsten bygger på anonymiserade eller pseudonymiserade data. Vi använder inte dina personuppgifter för att träna externa AI-modeller. AI-analys används endast för att ge dig feedback inom ramen för Tjänsten.

**11. Ändringar av policyn**
Vi kan uppdatera denna policy vid behov. Väsentliga ändringar meddelas via Tjänsten eller e-post innan de börjar gälla.

**12. Kontakt**
Frågor om integritet eller dataskydd:
Flexibel Friskvård & Hälsa Sverige AB
E-post: info@flexibelfriskvardhalsa.se
Adress: Kärra Centrum 7, Hisings Kärra
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
