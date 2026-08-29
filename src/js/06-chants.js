// Age of Empires-achtige taunts: nummer -> data-URI, gebouwd door build.py uit de losse
// mp3-bestanden in src/assets/chants/ (1.mp3, 2.mp3, ...) — precies zoals het logo (zie
// build.py). Een mp3 toevoegen/vervangen + opnieuw `python build.py` draaien is voldoende,
// hier hoeft nooit iets handmatig aangepast te worden.
const CHANT_AUDIO = {{CHANTS}};
function playChant(n){
  const src = CHANT_AUDIO[n];
  if (!src) return false;
  try { new Audio(src).play().catch(() => {}); } catch (e){}
  return true;
}
