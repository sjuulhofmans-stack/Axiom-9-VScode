// Age of Empires-achtige taunts: nummer -> data-URI, gebouwd door build.py uit de losse
// mp3-bestanden in src/assets/chants/ (1.mp3, 2.mp3, ...) — precies zoals het logo (zie
// build.py). Een mp3 toevoegen/vervangen + opnieuw `python build.py` draaien is voldoende,
// hier hoeft nooit iets handmatig aangepast te worden.
const CHANT_AUDIO = {{CHANTS}};
// Geeft het Audio-element terug (of null) i.p.v. alleen true/false — zodat een aanroeper 'm
// later weer kan stoppen (zie mpTriggerPaintracer in 99-multiplayer.js: de muziek moet stil
// zijn zodra het wagentje klaar is met rijden). Bestaande aanroepen die het resultaat negeren
// (playChant(7) als losse regel) blijven gewoon werken, een Audio-object is net zo goed
// truthy als de oude `true`.
function playChant(n){
  const src = CHANT_AUDIO[n];
  if (!src) return null;
  try {
    const audio = new Audio(src);
    audio.play().catch(() => {});
    return audio;
  } catch (e){ return null; }
}
