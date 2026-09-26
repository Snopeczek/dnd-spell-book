# DnD Spell Book — dokumentacja dla programisty

> Angielski opis projektu jest w [README.md](../README.md). Ten plik opisuje działanie i kod szczegółowo (po polsku).

Księga zaklęć do D&D 5e w formie regału z księgami. Cała nawigacja to regał: księgi stoją grzbietem do odbiorcy, a każda otwiera jedną część programu:

- **górna półka:** Kompendium (wszystkie zaklęcia) i księgi klas,
- **kolejne półki:** osobna księga każdej postaci (po 10 na półkę; po zapełnieniu półki pojawia się nowa), pusta księga „Nowa postać”, a na końcu pierwszej z tych półek Własne zaklęcia oraz Ustawienia i dane.

Otwarta księga to rozkładówka w okładce z widocznymi krawędziami kartek (więcej po prawej, mniej po lewej). W księgach klas i w Kompendium poziomy zaklęć (Cantrips, 1–9) są zakładkami wystającymi spomiędzy kartek przy prawej krawędzi, każda kolejna niżej; wybrana łączy się ze stroną, a kolumna zakładek zostaje na ekranie przy przewijaniu. Lewa strona to lista zaklęć, prawa karta zaklęcia (przyklejona przy przewijaniu). Zmiana zakładki przewraca kartki:

- **Do przodu** (wyższy poziom): prawa kartka unosi się na grzbiecie i przechodzi na lewo; na jej odwrocie jest już nowa lista. Na jednej stronie (wąski ekran) stara strona odchodzi w lewo i odsłania nową.
- **Do tyłu** (niższy poziom): kartka opada z lewej do prawej na stronę z poprzednią treścią. W rozkładówce lewa kartka przechodzi na prawą stronę; na jednej stronie nowa kartka unosi się z lewej krawędzi (od grzbietu) i opada na starą stronę.
- **Przeskok o kilka poziomów** przewraca kilka kartek (tyle, o ile poziomów, maks. 4) z opóźnieniem, jak wachlarz; kartki pośrednie to papier z liniami tekstu.
- **Ruch kartki:** kartka składa się z 10 pionowych pasków połączonych przegubami. Wygięcie biegnie falą od grzbietu do brzegu: na początku brzeg unosi się pierwszy (kartka ciągnięta za róg), przy lądowaniu opada ostatni. Każdy pasek ma cieniowanie zależne od kąta, a kartki rzucają cień na stronę, na którą opadają. Paski zachodzą na siebie o 1,5 px, żeby między warstwami 3D nie było szczelin.
- Jedna kartka trwa ok. 0,95 s (na wąskim ekranie 0,64 s), każda kolejna rusza 0,12 s później. Kliknięcia zakładek w trakcie są ignorowane, a przy ograniczeniu ruchu w systemie zmiana jest natychmiastowa.

Grubość grzbietu zależy od liczby zaklęć w środku i zmienia się na bieżąco. Księgi reagują na kursor jak fizyczne przedmioty (sprężyny z tłumieniem).

Obsługuje dwie wersje zasad, **2014** (SRD 5.1) i **2024** (SRD 5.2), jako osobne tryby. Każda wersja ma własne dane i własny stan; po przełączeniu nic się nie miesza.

Aplikacja to jeden samodzielny plik HTML: działa offline, bez serwera, a dane użytkownika trzyma w `localStorage` przeglądarki.

## Struktura projektu

```
dnd-spell-book/
├── README.md
├── docs/                     ta dokumentacja i zrzuty ekranu
├── .github/workflows/        publikacja na GitHub Pages i automatyczne testy
├── assets/
│   └── icon.ico              ikona aplikacji (trafia do paczki)
├── src/
│   ├── index.html            szablon strony ze znacznikami build:*
│   ├── styles.css            wszystkie style
│   ├── data/
│   │   ├── srd-2014.json     znormalizowane dane SRD 5.1
│   │   ├── srd-2024.json     znormalizowane dane SRD 5.2
│   │   └── load-dev.js       wczytuje JSON-y przy pracy bez budowania
│   └── js/                   moduły, dołączane w kolejności numerów
├── tests/                    testy Playwright (run_all.py uruchamia wszystkie)
│   └── fixtures/             wymyślone pliki importu do testów
└── tools/
    ├── build.py              składa jeden plik HTML i buduje paczkę ZIP
    ├── fetch_data.py         pobiera i normalizuje dane z 5e-database
    └── launcher/             pliki .bat dołączane do paczki
```

## Budowanie

Wymagany Python 3.8+ (bez dodatkowych bibliotek).

```
python tools/build.py            # dist/DnD Spell Book.html i dist/DnD Spell Book.zip
python tools/build.py --no-zip   # tylko plik HTML
```

`build.py` wstawia do `index.html` w miejsce znaczników `<!-- build:styles -->`, `<!-- build:data -->` i `<!-- build:scripts -->` kolejno: style, dane obu wersji (jako `window.SRD`) i wszystkie moduły z `src/js/` posortowane po nazwie. Plik HTML w paczce jest tym samym plikiem co `dist/DnD Spell Book.html`; ten sam plik jest też publikowany jako wersja online.

Praca bez budowania: uruchom w `src/` np. `python -m http.server` i otwórz `http://localhost:8000`. Plik `load-dev.js` wczyta wtedy JSON-y (przez `file://` to nie zadziała, bo przeglądarka blokuje odczyt plików).

### Testy

Testy przeglądarkowe w Playwright (Python) klikają po zbudowanej aplikacji i sprawdzają wyniki.

```
pip install playwright
python -m playwright install chromium
python tools/build.py --no-zip
python tests/run_all.py
```

Pliki w `tests/fixtures/` to wymyślona klasa i zaklęcie do testu importu. Prawdziwe treści spoza SRD nie trafiają do repozytorium. Na GitHubie testy uruchamiają się same przy każdym pushu (zakładka Actions).

### Aktualizacja danych

```
python tools/fetch_data.py                    # klonuje 5e-bits/5e-database (wymaga git)
python tools/fetch_data.py C:\sciezka\do\5e-database
```

## Paczka dla Windows

`DnD Spell Book.zip` zawiera folder `DnD Spell Book` z plikami:

| Plik | Działanie |
|---|---|
| `DnD Spell Book.html` | aplikacja |
| `icon.ico` | ikona skrótów |
| `DnD Spell Book.bat` | otwiera aplikację we własnym oknie: Edge, a gdy go brak Chrome, w trybie `--app`; w ostateczności domyślna przeglądarka |
| `Zainstaluj skroty.bat` | tworzy skróty z ikoną na pulpicie i w menu Start (przez PowerShell) |
| `Usun skroty.bat` | usuwa oba skróty; nie rusza programu ani danych |

Dane zapisują się w profilu przeglądarki dla adresów `file://`. Przeniesienie folderu nie kasuje danych, ale po przeniesieniu trzeba ponownie uruchomić „Zainstaluj skroty.bat”. Pliki `.bat` muszą być czystym ASCII; `build.py` to sprawdza i zapisuje je z końcami linii CRLF.

## Moduły (`src/js/`)

| Plik | Zawartość |
|---|---|
| `01-util.js` | DOM (`$`, `$$`), `esc`, renderowanie opisów (akapity, listy, tabele markdown), toast z „Cofnij” (wyświetlany także nad otwartym okienkiem), dialogi, pobieranie pliku |
| `02-data.js` | `Data` (dostęp do SRD, własnych zaklęć i własnych klas – `inClass`, sloty własnych klas z typu czarującego), `Rules` (modyfikator, biegłość, DC, limity, sloty, pact slots, Mystic Arcanum, obrażenia przy danym slocie) |
| `03-state.js` | `Store`: stan każdej wersji osobno, zapis w `localStorage`, `commit` z migawką do cofania; `newChar` |
| `04-spellcard.js` | `SpellCard`: pełna karta zaklęcia i krótkie opisy do list |
| `05-classbook.js` | wnętrze księgi klasy: rozkładówka z zakładkami poziomów (Cantrips, 1–9), lista zaklęć z wyszukiwaniem, karta szczegółów, dodawanie do księgi postaci; kolory okładek i emblematy klas; wspólne zakładki, rama rozkładówki i animacja przewracania kartki (`tabsHtml`, `spreadHtml`, `turnPage`); `Ribbons` – wstążki we wszystkich księgach (zapis, przycisk w wierszu, zakładka „Wstążki”) |
| `06-compendium.js` | Kompendium: rozkładówka z zakładkami ze wszystkimi zaklęciami, filtry i wyszukiwarka zmieniające liczby na zakładkach, lista, karta szczegółów |
| `07-book.js` | wnętrze księgi postaci jako rozkładówka: zakładka „Karta postaci” (klasa, poziom, cecha, statystyki, sloty, spis zaklęć, notatki) i zakładki C, 1–9 z zaklęciami postaci (przygotowywanie, „zawsze przygotowane”, usuwanie, karta zaklęcia); korekty i ręczne sloty; tworzenie postaci (`addChar`) |
| `08-homebrew.js` | księga „Własne zaklęcia” jako rozkładówka (zakładki „Wstążki”, C, 1–9; lista z edycją i usuwaniem, karta zaklęcia), edytor, kopiowanie zaklęcia z SRD, usuwanie |
| `09-classes.js` | własne klasy (np. z podręcznika spoza SRD): edytor („Edytuj klasę” w księdze klasy), usuwanie, lista zaklęć klasy (przeciąganie na grzbiet, „−” w księdze) |
| `10-settings.js` | wnętrze księgi „Ustawienia i dane”: kopia zapasowa (eksport/import), czyszczenie wersji, motyw, licencje |
| `11-bookcase.js` | regał: układ ksiąg na półkach (po 10 postaci na półkę), grubość grzbietów, fizyka (uniesienie, przechył, oparta księga, tarcie), animacje otwierania i odkładania, zwijanie do paska po otwarciu księgi |
| `12-drag.js` | przeciąganie zaklęć (myszą) na księgi postaci na regale: karteczka z zeszytu na spinaczu z fizyką wahadła, ograniczenie do listy klasy postaci, upuszczanie na „Nową postać” |
| `13-app.js` | start, przełącznik wersji, otwieranie i odkładanie ksiąg (`openBook`, `home`), nagłówek otwartej księgi, stała wysokość stron (`fitBook`), akcje z kart, skróty klawiszowe |

## Zasady działania

**Limity.** Program pokazuje limity na karcie postaci. Gdy limit cantripów (albo znanych zaklęć w klasach, które zaklęcia znają) jest pełny, przyciski „+” przy takich zaklęciach są przygaszone, a próba dodania kolejnego otwiera ostrzeżenie z wyborem „Anuluj” (domyślnie) lub „Dodaj mimo to” – na wypadek featów, przedmiotów czy cech rasy. W klasach przygotowujących zaklęcia nadmiarowe zaklęcie trafia do księgi jako nieprzygotowane, bez ostrzeżenia. Przekroczony limit jest też oznaczony na karcie postaci.

- 2014: Bard, Sorcerer, Warlock, Ranger znają zaklęcia (limit z tabeli klasy). Cleric, Druid i Wizard przygotowują modyfikator + poziom, Paladin modyfikator + połowa poziomu (minimum 1).
- 2024: wszystkie klasy przygotowują zaklęcia; limit z tabeli klasy.
- Zaklęcia „zawsze przygotowane” (★, np. z podklasy) nie liczą się do limitu.

**Regał.** Kliknięcie księgi ją otwiera z animacją. Księga w animacji to bryła 3D (okładka, blok kartek i grzbiet – kopia grzbietu z półki), skalowana proporcjonalnie, bez rozciągania: księga wysuwa się z półki (zostaje luka), obraca okładką do odbiorcy, przesuwa na środek ekranu i otwiera okładkę, pod którą pojawia się rozkładówka (ok. 1 s; przy włączonym w systemie ograniczeniu ruchu bez animacji). Regał zwija się wtedy do paska na górze, a otwarta księga jest w nim wysunięta. Pasek przy wielu półkach przewija się w poziomie.

Odkładanie księgi (przycisk „Odłóż na regał”, `Esc`, kliknięcie wysuniętej księgi na pasku) to odwrotność otwierania: nad rozkładówką pojawia się otwarta księga, okładka zamyka się na kartkach, regał rozwija się z paska, a zamknięta księga obraca się grzbietem do odbiorcy, leci na swoje miejsce, zawisa nad nim i wsuwa się na półkę (ok. 1,4 s; sąsiednie księgi drgają przez tarcie). Okładka i blok kartek znikają w końcowej fazie lotu, żeby w perspektywie nie było widać klina okładki obok grzbietu. Powrót na regał wywołany przez program (usunięcie otwartej postaci, przełączenie wersji) jest natychmiastowy.

**Wielkość stron.** Na szerokim ekranie obie strony rozkładówki mają równą szerokość, a księga stałą wysokość dopasowaną do okna, nie mniejszą niż kolumna zakładek (`App.fitBook`; liczona ponownie po zwinięciu regału do paska i przy zmianie rozmiaru okna); każda strona przewija się osobno, karta zaklęcia zostaje na górze prawej strony. Przy przewracaniu kartki kopie stron zachowują przewinięcie. Na wąskim ekranie (jedna strona) wysokość jest naturalna. Na pasku można przełączać księgi; kliknięcie wysuniętej księgi, przycisk „Odłóż na regał” albo `Esc` wraca do pełnego regału. Klawisz `/` otwiera Kompendium z kursorem w wyszukiwarce.

Grubość grzbietu (w pikselach, przed skalowaniem) rośnie liniowo z liczbą zaklęć:

| Księga | Wzór | Przykład |
|---|---|---|
| Kompendium | 30 + 0,19 × zaklęcia | 339 zaklęć → 94 px |
| Klasy | 26 + 0,2 × zaklęcia (SRD i własne z tą klasą) | Wizard 2024: 218 → 70 px |
| Postać | 26 + 1,6 × zaklęcia w księdze (maks. 110) | 10 zaklęć → 42 px |
| Własne zaklęcia | 28 + 2,4 × zaklęcia (maks. 96) | 5 zaklęć → 40 px |

Księgi klas mają po 40–220 zaklęć, więc jedno dodane zaklęcie zmienia je o ok. 0,2 px; księgi postaci i własnych zaklęć rosną wyraźnie. Zmiana grubości jest animowana.

Fizyka: każda księga ma sprężynę z tłumieniem dla uniesienia i przechyłu. Najechana księga unosi się i przechyla w stronę kursora; ostatnia księga na półce jest oparta o sąsiadkę i unosi się razem z nią; bezpośredni sąsiedzi reagują lekko (tarcie). Przy włączonym w systemie ograniczeniu ruchu animacje są wyłączone.

**Multiklasa.** Na karcie postaci „+ Dodaj klasę (multiklasa)” dodaje kolejną klasę z własnym poziomem i wartością cechy (`ch.multi: [{cls, lvl, score}]`). Nie można wybrać klasy, którą postać już ma (ani jako główną, ani drugi raz), a łączny poziom nie przekracza 20; jednorazowa „Własna klasa” nie łączy się z multiklasą. Premia biegłości wynika z łącznego poziomu; DC i atak są liczone osobno dla każdej klasy. Sloty: przy jednej klasie czarującej – jej własna tabela; przy kilku – tabela multiklasy (tabela pełnego czarującego) dla poziomu czarującego = pełni czarujący (Bard, Cleric, Druid, Sorcerer, Wizard) w całości + Paladin i Ranger w połowie (2014: w dół, 2024: w górę, osobno dla każdej klasy) + własne klasy według typu (pół: w górę lub w dół, jedna trzecia: w dół). Pact slots Warlocka są osobne (z poziomu Warlocka). Limity cantripów i zaklęć są sumą limitów klas (program nie zapisuje, z której klasy pochodzi konkretne zaklęcie); przy przeciąganiu postać przyjmuje zaklęcie z listy którejkolwiek ze swoich klas.

**Własne klasy.** Program może mieć klasy spoza SRD (np. Artificera), ale sam ich nie zawiera: klasa trafia do programu z pliku kopii zapasowej (pole `classes`), a jej dane wpisuje użytkownik. Własna klasa stoi na górnej półce za klasami SRD, ma zakładki C i 1–9 (i „Wstążki”) oraz przycisk „Edytuj klasę”: nazwa, cecha rzucania, typ czarującego, tryb zaklęć (przygotowywane/znane), kolor okładki, emblemat i tabela 20 poziomów z liczbą cantripów i przygotowanych/znanych zaklęć (puste pole = bez limitu; „Wypełnij jak klasa z SRD” kopiuje liczby jako punkt wyjścia). Sloty program liczy sam, jak w tabelach pojedynczych klas SRD (to nie jest tabela multiclassingu):

| Typ | Poziom „efektywny” w tabeli pełnego czarującego (Wizard) | Zgodne z |
|---|---|---|
| Pełny | L | Wizard |
| Półczarujący od 1. poziomu | ⌈L/2⌉ | Paladin i Ranger 2024 |
| Półczarujący od 2. poziomu | ⌈L/2⌉ od L ≥ 2 | Paladin i Ranger 2014 |
| Jedna trzecia od 3. poziomu | ⌈L/3⌉ od L ≥ 3 | – |
| Pakt | tabela Warlocka | Warlock |

Listę zaklęć klasy buduje się, przeciągając zaklęcia (z Kompendium, ksiąg klas i Własnych zaklęć) na grzbiet jej księgi; „−” w jej księdze usuwa zaklęcie z listy. Limity i ograniczenie klasy przy przeciąganiu działają jak dla klas SRD. Usunięcie klasy (z „Cofnij”) zamienia postacie tej klasy na jednorazową „Własną klasę” o tej samej nazwie, cesze i slotach.

**Księgi klas.** Każda klasa z SRD ma księgę z własnym kolorem okładki i emblematem; pod zakładką danego poziomu są zaklęcia z listy tej klasy (z SRD oraz własne, którym zaznaczono tę klasę). Zakładki bez zaklęć są wyszarzone. Każda wersja zasad pamięta osobno ostatnio otwartą księgę i wybraną zakładkę.

**Księga postaci.** Też jest rozkładówką z zakładkami. Pierwsza zakładka, „Karta postaci” (z emblematem klasy), ma na lewej stronie imię, klasę, poziom, cechę i statystyki (DC, atak, premia biegłości, limity cantripów i zaklęć, najwyższy slot) oraz przyciski „Korekty i sloty” i „Usuń postać”; na prawej: tabelę slotów (z pact slots i Mystic Arcanum), spis zaklęć według poziomów (kliknięcie przewraca do zakładki) i notatki. Zakładki C i 1–9 zawierają tylko zaklęcia postaci: na lewej stronie lista z zaznaczaniem przygotowanych, ★ „zawsze przygotowane”, usuwaniem i przyciskiem „Dodaj z księgi klasy” (otwiera księgę klasy na tym samym poziomie), na prawej karta wybranego zaklęcia. Zakładki bez zaklęć są wyłączone; po usunięciu ostatniego zaklęcia z poziomu księga wraca do karty postaci. Każda postać pamięta swoją otwartą zakładkę. Na dole karty postaci jest sekcja „Wygląd księgi”: kolor skóry (12 kolorów albo „A” – automatyczny, stały dla postaci) i emblemat (emblemat klasy, jeden z emblematów klas SRD albo ogólny: zębatka, kolba, młotek, kryształ, gwiazda, księżyc, czaszka). Zmiana jest od razu widoczna na regale, w nagłówku, na okładce, na zakładce „karta” i w animacjach; wybrany emblemat zostaje po zmianie klasy.

**Przeciąganie zaklęć na regał.** Przy otwartej księdze zaklęcie z listy (księga klasy, Kompendium, księga postaci) można przeciągnąć myszą na księgę postaci na pasku regału. Pod kursorem wisi karteczka – kartka z zeszytu w linie, z dziurkami, postrzępioną krawędzią i spinaczem – która buja się na boki jak wahadło (sprężyna z tłumieniem, kąt zależy od prędkości ruchu); nad regałem maleje i staje się półprzezroczysta, żeby nie zasłaniać ksiąg.

- Na księgę postaci można upuścić tylko zaklęcie z listy jej klasy (`Book.fitsClass`; wyjątki: własna klasa i własne zaklęcia bez przypisanych klas). W trakcie przeciągania pasujące księgi postaci się powiększają, niepasujące i pozostałe księgi są przygaszone; nad celem pojawia się podpis („Dodaj do: Elmira” albo powód odmowy).
- Upuszczenie na pasującą księgę: karteczka wpada w grzbiet, księga podskakuje i pogrubia się; komunikat z „Cofnij”. Obowiązują ostrzeżenia o limicie cantripów i znanych zaklęć.
- Upuszczenie na niepasującą księgę albo na księgę, która ma już to zaklęcie: grzbiet „odmownie” się trzęsie, karteczka wraca na listę, komunikat wyjaśnia powód.
- Upuszczenie na „Nową postać”: nowa postać z klasą otwartej księgi (albo pierwszą klasą z listy zaklęcia, gdy przeciąga się z Kompendium) i tym zaklęciem w księdze.
- Upuszczenie poza regał albo `Esc` przerywa przeciąganie. Krótkie kliknięcie w wiersz nadal wybiera zaklęcie. Na ekranach dotykowych przeciąganie jest wyłączone (zostaje „+”). Przycisk „+” nie ma ograniczenia klasy – dodaje także zaklęcia spoza listy (z oznaczeniem).

**Własne zaklęcia.** Księga „Własne zaklęcia” jest rozkładówką jak księgi klas: zakładki C i 1–9 (oraz „Wstążki”), na lewej stronie lista z przyciskiem „+ Nowe zaklęcie”, edycją i usuwaniem w każdym wierszu, na prawej karta wybranego zaklęcia (z przyciskiem „Edytuj”). Po utworzeniu lub edycji zaklęcia księga przechodzi na jego zakładkę i je zaznacza.

**Wstążki.** W każdej księdze (klasy, Kompendium, postaci, Własne zaklęcia) przycisk-wstążka w wierszu listy zaznacza zaklęcie. Z grzbietu księgi, która ma wstążki, wystaje od góry czerwona wstążka (po najechaniu: liczba zaznaczonych). W księdze jest zakładka „Wstążki” (na górze kolumny zakładek; w księdze postaci zaraz za „kartą”) z zaznaczonymi zaklęciami ze wszystkich poziomów, pogrupowanymi według poziomu; bez wstążek jest wyłączona. Zakładka „Wstążki” ma wartość −0,5 (między kartą postaci −1 a Cantrips 0), co wyznacza kierunek przewracania kartek. Wstążki księgi postaci są częścią postaci (trafiają do kopii zapasowej, usunięcie zaklęcia z księgi zdejmuje jego wstążkę); wstążki pozostałych ksiąg zostają tylko w przeglądarce. W Kompendium licznik wstążek uwzględnia filtry.

**Kompendium.** Wszystkie zaklęcia wersji pod 10 zakładkami. Wyszukiwarka i filtry (szkoła, klasa, Concentration, Ritual, źródło, komponent M, księga postaci) zmieniają liczby na zakładkach; jeśli pod wybraną zakładką nic nie pasuje, otwiera się pierwsza zakładka z wynikami.

**Sloty.** Z tabel klas SRD (liczba i najwyższy dostępny poziom w księdze postaci). Warlock ma pact slots i Mystic Arcanum (poziomy 11/13/15/17). W „Korekty i sloty” można ustawić sloty ręcznie (multiclass, własna klasa) i dodać premie do limitów, DC i ataku.

**Co czyszczą przyciski:**

| Przycisk | Czyści | Zostaje | Cofnij |
|---|---|---|---|
| Usuń z księgi (×) | to jedno zaklęcie z księgi postaci | reszta księgi | tak |
| Usuń postać | postać z jej księgą (znika z regału) | inne postacie, własne zaklęcia | tak |
| Usuń własne zaklęcie | zaklęcie oraz jego wpisy we wszystkich księgach tej wersji | reszta | tak |
| Wyczyść filtry | filtry i wyszukiwanie kompendium | wybrana zakładka i wszystko inne | nie (nic nie traci) |
| Usuń klasę (edytor klasy) | własną klasę; postacie tej klasy dostają jednorazową „Własną klasę” z tymi samymi slotami | postacie, ich księgi | tak |
| Wyczyść dane wersji | postacie, księgi, własne zaklęcia, własne klasy, filtry i otwartą księgę klasy **aktywnej** wersji | druga wersja, motyw, otwarta księga | tak (+ potwierdzenie) |
| Wczytaj kopię | nic (import tylko dodaje) | wszystko | tak |

„Cofnij” jest dostępne w powiadomieniu przez kilka sekund i dotyczy ostatniej akcji.

## Format danych

### Dane SRD (`src/data/srd-XXXX.json`)

```json
{ "ver": "2024", "srd": "SRD 5.2", "source": "5e-bits/5e-database@<commit>",
  "classes": { "wizard": { "n": "Wizard", "ab": "INT", "mode": "prepared", "from": 1,
               "t": { "5": { "c": 4, "p": 9, "s": [4,3,2,0,0,0,0,0,0] } } } },
  "spells": [ { "id": "fireball", "n": "Fireball", "l": 3, "s": "Evocation", "c": ["sorcerer","wizard"],
                "ct": "Action", "r": "150 feet", "cp": ["V","S","M"], "m": "…", "d": "Instantaneous",
                "co": false, "ri": false, "x": ["akapit", "…"], "hl": "…", "hlL": "Using a Higher-Level Spell Slot",
                "sv": "DEX", "at": "ranged",
                "dm": { "t": "Fire", "sl": { "3": "8d6", "4": "9d6" } },
                "he": { "1": "2d8 + MOD" } } ] }
```

Klasy: `c` cantripy, `k` znane zaklęcia (2014), `p` przygotowane (2024), `s` sloty poziomów 1–9 (dla Warlocka to pact slots), `prep` sposób liczenia przygotowanych w 2014 (`full`/`half`), `arc` Mystic Arcanum.
Zaklęcia: `dm.sl` obrażenia wg poziomu slotu, `dm.ch` wg poziomu postaci (cantripy), `he` leczenie; `MOD` oznacza modyfikator cechy. `sc` (tylko 2014) to podklasy z SRD.

W danych 2024 dziewięć zaklęć (np. Guidance, Divine Smite) ma w źródle komponenty wklejone do pola zasięgu („Touch Component: V, S”); `fetch_data.py` je rozdziela.

W danych 2024 tabele obrażeń i leczenia dla wyższych slotów oraz skalowanie cantripów nie występują wprost; `fetch_data.py` wylicza je z tekstu opisu. Gdzie się nie da (np. Magic Missile 2024), karta pokazuje tylko opis.

### Stan w `localStorage`

Zabezpieczenie: postać przypisana do klasy, której nie ma ani w SRD, ani wśród własnych klas (np. po imporcie niepełnej kopii), jest przy starcie i przy imporcie zamieniana na jednorazową „Własną klasę” o tej samej nazwie i cesze, ze slotami według swojego poziomu (`Store.migrateCustomClasses`).

- `dndsb:app` – `{ ver, open: {kind, id}|null, theme }`; `kind`: `class`, `compendium`, `char`, `homebrew`, `settings`
- `dndsb:ver:2014`, `dndsb:ver:2024` – `{ schema, chars[], active, homebrew[], filters:{q, desc, schools, cls, conc, rit, src, noM, char, lvl}, sel, shelf:{cls, lvl, sel, q}, charView:{ [id postaci]: {tab, sel} }, ribbons:{ [klucz księgi]: [id] }, hbView:{lvl, sel}, classes:[{ id, n, ab, caster, mode, color, emblem, rows:[{c, p}]×20, spells:[id] }] }` (`tab` −1 = karta postaci, −0,5 = Wstążki; klucz księgi jak na regale, np. `class:wizard`, `compendium:`, `homebrew:`)

Postać: `{ id, name, cls, lvl, score, ab, customName, adj:{c,s}, dcBonus, atkBonus, override:{slots[9], pactN, pactL}|null, spells:{ [id]: {prep, always} }, notes, look?:{color, emblem}, ribbons?:[id], multi?:[{cls, lvl, score}] }` (`lvl` i `score` dotyczą klasy głównej) (`look` tylko gdy wybrano wygląd inny niż automatyczny). Pola `used`, `pactUsed`, `arcUsed`, `conc` zostały po usuniętym trybie sesji; są ignorowane.
Własne zaklęcie: format jak zaklęcie SRD oraz `hb: true` i `src` (pola edytora). Identyfikatory zaczynają się od `hb-`.

### Kopia zapasowa

```json
{ "app": "dnd-spell-book", "format": 1, "exported": "…",
  "versions": { "2014": { "chars": [], "homebrew": [], "classes": [] }, "2024": { … } } }
```

## Licencje

- Treści zaklęć i klas: **System Reference Document 5.1** oraz **System Reference Document 5.2**, Wizards of the Coast LLC, licencja [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/legalcode). Pełne oświadczenia o źródle są w aplikacji (księga „Ustawienia i dane” na regale), a krótkie w stopce każdego widoku.
- Dane w formacie JSON: projekt [5e-bits/5e-database](https://github.com/5e-bits/5e-database), licencja MIT.
- Dane zostały przetworzone: skrócone do potrzebnych pól, przeformatowane, a tabele obrażeń dla 2024 wyliczone z opisów.
- Emblematy klas na okładkach to oryginalne rysunki wykonane dla tego programu (SVG w `05-classbook.js`), nie grafiki Wizards of the Coast ani D&D Beyond.
- DnD Spell Book nie jest produktem Wizards of the Coast i nie jest przez nich wspierany.
