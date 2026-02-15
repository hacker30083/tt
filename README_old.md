# Automaatne tunniplaani koostaja Tartu Erakool ProTERA 9. klassi jaoks.

## Kuidas see töötab?
Selles programmis on ametlikust tunniplaanist võetud info kirjutatud ümber masinloetavasse formaati. Siis, kui sisestad enda grupid, loeb arvuti kõik läbi ja leiab vastavad tunnid.

## Kes näeb, millistes gruppides ma olen?
Kui sisestad enda grupid, jääb see info Sinu veebilehitseja **küpsistesse**. Tavatingimustes ei lahku see info Sinu seadmest. Jagamisel saavad kõik, kellele lingi saadad, näha, mis grupid sa sisestanud oled.

## Kuidas töötab jagamine?
Kui vajutad *Jaga*, koostab programm lingi ja koodi.  

**Kui link avatakse, toimub järgnev:**
1. veebilehitseja esitab päringu serverile
	- Antud juhul esitatakse päring GitHub Pages'ile. Kuna link ise sisaldab gruppide infot, saab GitHub ka selle info teada. Selle vältimiseks saab kasutada koodi ilma lingita.
2. server saadab vastusena programmi
3. programm loeb lingist koodi
4. programm loeb koodist grupid välja
5. programm koostab tunniplaani

**Kui sisestad koodi, toimub järgnev:**
1. programm loeb koodist grupid välja
2. programm koostab tunniplaani

Kui Sa ei soovi, et gruppide koosseisu info kõrvaliste isikute kätte satuks, on targem jagada ainult kood või lihtsalt öelda enda grupid otse teistele.  

Kood sisaldab gruppide koosseisu masinloetavas formaadis, kuid võimalik on sellelt grupid välja lugeda ka ilma programmi kasutamata. Lingis on kood parameetrina pärast alamkataloogi- või failinime (st `.../tt/?g=KOOD`).