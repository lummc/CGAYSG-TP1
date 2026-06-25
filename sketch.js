let trazosVerticales = [];
let trazosHorizontales = [];
let trazosDiagonales = [];

let fondos = [];
let fondoActual = 0;
let fondoAnterior = 0;
let transicionFondo = 1;

let dibujos = [];
let maxTrazos = 120;

let mic;
let fft;
let audioActivo = false;
let audioIniciado = false;

let amplitud = 0;
let amplitudSuavizada = 0;
let amplitudAnterior = 0;
let incrementoAmplitud = 0;
let graves = 0;
let medios = 0;
let agudos = 0;
let sibilantes = 0;
let diferenciaBandas = 0;
let duracionSonido = 0;
let estadoSonoro = "silencio";
let duracionSostenido = 2200;
let estadoCandidato = "";
let tiempoEstadoCandidato = 0;
let tiempoParaDefinirFamilia = 700;
let aplausoDetectado = false;
let tiempoUltimoAplauso = -1000;
let intervaloAplauso = 900;

let umbralSonido = 0.005;
let umbralAlto = 0.014;
let ultimoAgregar = 0;
let ultimoBorrar = 0;
let ultimoFondo = 0;
let intervaloAgregar = 260;
let intervaloBorrar = 520;
let intervaloFondo = 1800;

let mostrarPanelDebug = true;
let mostrarLogsTrazos = true;
let ultimoLogTrazos = 0;

let nucleoX;
let nucleoY;
let nucleoBaseX;
let nucleoBaseY;

let desviacionX;
let desviacionY;
let desviacionBaseX;
let desviacionBaseY;

let familiaDefinida = false;
let modoCompositivo = "";
let anguloRector = 0;
let variacionAngular = 15;
let probabilidadFueraDeRegla = 0.03;

function preload() {
  for (let i = 1; i <= 13; i++) {
    let nombre = "trazos/trazo v " + i + ".png";
    let imagen = loadImage(nombre);
    imagen.nombreArchivo = nombre;
    trazosVerticales.push(imagen);
  }

  let indicesHorizontales = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11];
  for (let i = 0; i < indicesHorizontales.length; i++) {
    let nombre = "trazos/trazo h " + indicesHorizontales[i] + ".png";
    let imagen = loadImage(nombre);
    imagen.nombreArchivo = nombre;
    trazosHorizontales.push(imagen);
  }

  for (let i = 1; i <= 20; i++) {
    let nombre = "trazos/trazo d " + i + ".png";
    let imagen = loadImage(nombre);
    imagen.nombreArchivo = nombre;
    trazosDiagonales.push(imagen);
  }

  for (let i = 0; i <= 5; i++) {
    fondos[i] = loadImage("fondos/fondo" + i + ".png");
  }

  console.log("preload()", {
    trazosVerticales: trazosVerticales.length,
    trazosHorizontales: trazosHorizontales.length,
    trazosDiagonales: trazosDiagonales.length,
    fondos: fondos.length
  });
}

function setup() {
  createCanvas(720, 1080);
  imageMode(CORNER);
  textFont("monospace");

  inicializarComposicion();

  mic = new p5.AudioIn();
  fft = new p5.FFT(0.85, 1024);
  fft.setInput(mic);
}

function draw() {
  analizarAudio();
  actualizarEstadoSonoro();
  actualizarObra();

  dibujarFondo();
  dibujarTrazos();

  if (mostrarPanelDebug) {
    mostrarDebug();
  }
}

function mousePressed() {
  activarAudio();
}

function keyPressed() {
  if (key === "a" || key === "A") {
    activarAudio();
  }

  if (key === "r" || key === "R") {
    borrarTrazo();
  }

  if (key === "f" || key === "F" || key === " ") {
    cambiarFondo();
  }

  if (key === "x" || key === "X") {
    reiniciarObra();
  }

  if (key === "d" || key === "D") {
    mostrarPanelDebug = !mostrarPanelDebug;
  }

  if (key === "t" || key === "T") {
    if (!familiaDefinida) {
      definirFamiliaCompositiva("agudo fuerte");
    }

    agregarGrupoDeTrazos("fino");
  }
}

function activarAudio() {
  if (audioIniciado) {
    return;
  }

  userStartAudio().then(function () {
    mic.start(
      function () {
        fft.setInput(mic);
        audioActivo = true;
        audioIniciado = true;
      },
      function () {
        audioActivo = false;
        audioIniciado = false;
      }
    );
  });
}

function analizarAudio() {
  if (!audioActivo) {
    amplitud = 0;
    amplitudSuavizada = 0;
    amplitudAnterior = 0;
    incrementoAmplitud = 0;
    graves = 0;
    medios = 0;
    agudos = 0;
    sibilantes = 0;
    diferenciaBandas = 0;
    duracionSonido = 0;
    aplausoDetectado = false;
    return;
  }

  amplitudAnterior = amplitud;
  amplitud = mic.getLevel();
  incrementoAmplitud = max(0, amplitud - amplitudAnterior);
  amplitudSuavizada = lerp(amplitudSuavizada, amplitud, 0.18);

  fft.analyze();
  graves = fft.getEnergy(70, 250);
  medios = fft.getEnergy(250, 1800);
  agudos = fft.getEnergy(1800, 5000);
  sibilantes = fft.getEnergy(3000, 9000);
  diferenciaBandas = max(graves, medios, agudos) - min(graves, medios, agudos);

  detectarAplauso();

  if (amplitudSuavizada > umbralSonido) {
    duracionSonido += deltaTime;
  } else {
    duracionSonido = 0;
  }
}

function actualizarEstadoSonoro() {
  if (!audioActivo) {
    estadoSonoro = "mic inactivo";
    return;
  }

  if (amplitudSuavizada <= umbralSonido) {
    estadoSonoro = "silencio";
    return;
  }

  let energiaMaxima = max(graves, medios, agudos);
  let energiaMinima = min(graves, medios, agudos);
  diferenciaBandas = energiaMaxima - energiaMinima;
  let energiaTotal = graves + medios + agudos + 1;
  let proporcionGrave = graves / energiaTotal;
  let proporcionMedia = medios / energiaTotal;
  let proporcionAguda = agudos / energiaTotal;

  let energiaRepartida = diferenciaBandas < 35 && medios > 10 && agudos > 10 && proporcionGrave < 0.45;
  let ruidoSibilante = sibilantes > 8 && (sibilantes > graves * 0.55 || proporcionAguda > 0.24);
  let posibleNoTonal = amplitudSuavizada > umbralSonido * 0.7 && (ruidoSibilante || energiaRepartida);
  let posibleAgudo =
    amplitudSuavizada > umbralAlto * 0.85 &&
    (proporcionAguda > 0.22 || sibilantes > 14 || agudos > graves * 1.05 || medios > graves * 1.25);
  let posibleGrave =
    amplitudSuavizada > umbralSonido * 1.3 &&
    proporcionGrave > 0.38 &&
    graves > medios * 1.15 &&
    graves > agudos * 1.35;
  let posibleSostenido = duracionSonido > duracionSostenido && !posibleNoTonal && !posibleAgudo && !posibleGrave;

  if (posibleNoTonal) {
    estadoSonoro = "no tonal";
  } else if (posibleAgudo) {
    estadoSonoro = "agudo fuerte";
  } else if (posibleGrave) {
    estadoSonoro = "grave bajo/medio";
  } else if (posibleSostenido) {
    estadoSonoro = "sostenido";
  } else {
    estadoSonoro = "sonido medio";
  }
}

function detectarAplauso() {
  aplausoDetectado = false;

  let ahora = millis();
  let energiaGolpe = medios + agudos + sibilantes;
  let predominioMedioAgudo = energiaGolpe > graves * 1.35;
  let picoRepentino = amplitud > 0.045 && incrementoAmplitud > 0.025;
  let sonidoBreve = duracionSonido < 280;
  let sinCooldown = ahora - tiempoUltimoAplauso > intervaloAplauso;

  if (picoRepentino && predominioMedioAgudo && sonidoBreve && sinCooldown) {
    aplausoDetectado = true;
    tiempoUltimoAplauso = ahora;
  }
}

function actualizarCandidatoFamilia(nuevoEstado) {
  let estadoValido =
    nuevoEstado === "agudo fuerte" ||
    nuevoEstado === "grave bajo/medio" ||
    nuevoEstado === "sostenido" ||
    nuevoEstado === "sonido medio" ||
    nuevoEstado === "no tonal";

  if (!estadoValido) {
    estadoCandidato = "";
    tiempoEstadoCandidato = 0;
    return;
  }

  if (nuevoEstado !== estadoCandidato) {
    estadoCandidato = nuevoEstado;
    tiempoEstadoCandidato = 0;
    return;
  }

  tiempoEstadoCandidato += deltaTime;

  if (tiempoEstadoCandidato >= tiempoParaDefinirFamilia) {
    definirFamiliaCompositiva(estadoCandidato);
    estadoCandidato = "";
    tiempoEstadoCandidato = 0;
  }
}

function actualizarObra() {
  let ahora = millis();

  if (aplausoDetectado) {
    reiniciarObraPorAplauso();
    return;
  }

  actualizarComposicionSonora();

  if (estadoSonoro === "silencio" || estadoSonoro === "mic inactivo") {
    actualizarCandidatoFamilia("");
    respirarObra();
    return;
  }

  if (!familiaDefinida) {
    actualizarCandidatoFamilia(estadoSonoro);
    return;
  }

  if (estadoSonoro === "agudo fuerte" && ahora - ultimoAgregar > intervaloAgregar) {
    agregarGrupoDeTrazos("fino");
    ultimoAgregar = ahora;
  }

  if (estadoSonoro === "grave bajo/medio" && ahora - ultimoFondo > intervaloFondo) {
    cambiarFondo();
    ultimoFondo = ahora;
  }

  if (estadoSonoro === "no tonal" && ahora - ultimoBorrar > intervaloBorrar) {
    borrarTrazo();
    ultimoBorrar = ahora;
  }

  if (estadoSonoro === "sostenido" && ahora - ultimoAgregar > intervaloAgregar * 1.4) {
    agregarGrupoDeTrazos("largo");
    ultimoAgregar = ahora;
  }

  if (transicionFondo < 1) {
    transicionFondo += 0.025;
  } else {
    transicionFondo = 1;
  }
}

function respirarObra() {
  if (transicionFondo < 1) {
    transicionFondo += 0.01;
  }
}

function inicializarComposicion() {
  nucleoBaseX = width * 0.5;
  nucleoBaseY = height * 0.52;
  nucleoX = nucleoBaseX;
  nucleoY = nucleoBaseY;

  desviacionBaseX = width * 0.11;
  desviacionBaseY = height * 0.14;
  desviacionX = desviacionBaseX;
  desviacionY = desviacionBaseY;

  familiaDefinida = false;
  modoCompositivo = "";
  anguloRector = 0;
  estadoCandidato = "";
  tiempoEstadoCandidato = 0;
  aplausoDetectado = false;
}

function actualizarComposicionSonora() {
  let objetivoX = nucleoBaseX;
  let objetivoY = nucleoBaseY;
  let objetivoDesviacionX = desviacionBaseX;
  let objetivoDesviacionY = desviacionBaseY;

  if (estadoSonoro === "agudo fuerte") {
    objetivoY = height * 0.45;
  } else if (estadoSonoro === "grave bajo/medio") {
    objetivoY = height * 0.60;
  } else if (estadoSonoro === "sostenido") {
    objetivoDesviacionX = width * 0.15;
    objetivoDesviacionY = height * 0.18;
  } else if (estadoSonoro === "no tonal") {
    objetivoX = nucleoBaseX + sin(frameCount * 0.025) * width * 0.025;
  }

  nucleoX = lerp(nucleoX, objetivoX, 0.025);
  nucleoY = lerp(nucleoY, objetivoY, 0.025);
  desviacionX = lerp(desviacionX, objetivoDesviacionX, 0.02);
  desviacionY = lerp(desviacionY, objetivoDesviacionY, 0.02);
}

function definirFamiliaCompositiva(estadoInicial) {
  if (familiaDefinida) {
    return;
  }

  if (estadoInicial === "agudo fuerte") {
    modoCompositivo = "vertical";
    anguloRector = 90;
  } else if (estadoInicial === "grave bajo/medio") {
    modoCompositivo = "horizontal";
    anguloRector = 0;
  } else if (estadoInicial === "sostenido") {
    modoCompositivo = "diagonal";
    anguloRector = 45;
  } else {
    modoCompositivo = "diagonal_inversa";
    anguloRector = -45;
  }

  familiaDefinida = true;

  if (mostrarLogsTrazos) {
    console.log("familia compositiva definida", {
      estadoInicial: estadoInicial,
      modoCompositivo: modoCompositivo,
      anguloRector: anguloRector
    });
  }
}

function agregarGrupoDeTrazos(tipo) {
  if (!familiaDefinida) {
    definirFamiliaCompositiva(estadoSonoro);
  }

  let cantidad = int(random(3, 7));

  for (let i = 0; i < cantidad; i++) {
    agregarTrazo(tipo);
  }
}

function agregarTrazo(tipo) {
  if (dibujos.length >= maxTrazos) {
    dibujos.shift();
  }

  let fueraDeRegla = random() < probabilidadFueraDeRegla;
  let imagen = elegirImagenTrazo(fueraDeRegla);
  let direccion = modoCompositivo;
  let posicion = calcularPosicionGaussiana();
  let anguloTrazo = calcularRotacionTrazo(fueraDeRegla);
  let opacidad = elegirOpacidad(tipo);

  dibujos.push({
    imagen: imagen,
    x: posicion.x,
    y: posicion.y,
    altoVisible: 0,
    escala: tipo === "fino" ? random(0.28, 0.58) : random(0.45, 0.9),
    opacidad: opacidad,
    velocidad: tipo === "largo" ? random(16, 34) : random(8, 22),
    direccion: direccion,
    angulo: anguloTrazo,
    fueraDeRegla: fueraDeRegla,
    curva: random(-28, 28),
    desvaneciendo: false
  });

  if (mostrarLogsTrazos) {
    let dibujoNuevo = dibujos[dibujos.length - 1];

    console.log("agregarTrazo()", {
      cantidadDibujos: dibujos.length,
      modoCompositivo: modoCompositivo,
      imagenElegida: imagen ? imagen.nombreArchivo : "imagen no cargada",
      anchoOriginal: imagen ? imagen.width : "imagen no cargada",
      altoOriginal: imagen ? imagen.height : "imagen no cargada",
      x: dibujoNuevo.x,
      y: dibujoNuevo.y,
      opacidad: dibujoNuevo.opacidad,
      escala: dibujoNuevo.escala,
      direccion: dibujoNuevo.direccion,
      fueraDeRegla: dibujoNuevo.fueraDeRegla,
      nucleoX: nucleoX,
      nucleoY: nucleoY,
      desviacionX: desviacionX,
      desviacionY: desviacionY,
      angulo: dibujoNuevo.angulo
    });
  }
}

function elegirImagenTrazo(fueraDeRegla) {
  if (!fueraDeRegla) {
    if (modoCompositivo === "vertical") {
      return random(trazosVerticales);
    }

    if (modoCompositivo === "horizontal") {
      return random(trazosHorizontales);
    }

    return random(trazosDiagonales);
  }

  let familiasAlternativas = [];

  if (modoCompositivo !== "vertical") {
    familiasAlternativas.push(trazosVerticales);
  }

  if (modoCompositivo !== "horizontal") {
    familiasAlternativas.push(trazosHorizontales);
  }

  if (modoCompositivo !== "diagonal" && modoCompositivo !== "diagonal_inversa") {
    familiasAlternativas.push(trazosDiagonales);
  }

  return random(random(familiasAlternativas));
}

function calcularRotacionTrazo(fueraDeRegla) {
  if (!fueraDeRegla) {
    return anguloRector + random(-variacionAngular, variacionAngular);
  }

  let desvio = random([random(65, 115), random(-115, -65)]);
  return anguloRector + desvio;
}

function calcularPosicionGaussiana() {
  let x = randomGaussian(nucleoX, desviacionX);
  let y = randomGaussian(nucleoY, desviacionY);

  x = constrain(x, width * 0.18, width * 0.82);
  y = constrain(y, -height * 0.08, height * 1.08);

  return {
    x: x,
    y: y
  };
}

function elegirOpacidad(tipo) {
  if (tipo === "fino") {
    return random() < 0.65 ? random(115, 155) : random(190, 230);
  }

  if (tipo === "largo") {
    return random() < 0.7 ? random(180, 235) : random(120, 165);
  }

  return random() < 0.65 ? random(130, 175) : random(210, 240);
}

function elegirDireccion(tipo) {
  if (tipo === "largo") {
    return random(["vertical", "curva"]);
  }

  if (estadoSonoro === "grave bajo/medio") {
    return "horizontal";
  }

  if (estadoSonoro === "sostenido") {
    return random(["vertical", "horizontal", "curva"]);
  }

  return random(["vertical", "vertical", "curva"]);
}

function borrarTrazo() {
  let cantidad = min(int(random(2, 4)), dibujos.length);

  for (let i = 0; i < cantidad; i++) {
    let indice = dibujos.length - 1 - i;

    if (indice >= 0) {
      dibujos[indice].desvaneciendo = true;
    }
  }
}

function cambiarFondo() {
  fondoAnterior = fondoActual;
  fondoActual++;

  if (fondoActual >= fondos.length) {
    fondoActual = 0;
  }

  transicionFondo = 0;
}

function dibujarFondo() {
  background(255);

  tint(255, 255);
  image(fondos[fondoAnterior], 0, 0, width, height);

  tint(255, transicionFondo * 255);
  image(fondos[fondoActual], 0, 0, width, height);
  noTint();
}

function dibujarTrazos() {
  if (mostrarLogsTrazos && millis() - ultimoLogTrazos > 1200) {
    console.log("dibujarTrazos()", {
      cantidadDibujos: dibujos.length,
      estadoSonoro: estadoSonoro,
      amplitud: amplitud,
      amplitudSuavizada: amplitudSuavizada,
      graves: graves,
      medios: medios,
      agudos: agudos,
      sibilantes: sibilantes,
      diferenciaBandas: diferenciaBandas,
      umbralSonido: umbralSonido,
      umbralAlto: umbralAlto
    });

    ultimoLogTrazos = millis();
  }

  imageMode(CENTER);

  for (let i = dibujos.length - 1; i >= 0; i--) {
    let dibujo = dibujos[i];
    let imagenTrazo = dibujo.imagen;

    if (!imagenTrazo) {
      continue;
    }

    let anchoTrazo = imagenTrazo.width * dibujo.escala;
    let altoTrazo = imagenTrazo.height * dibujo.escala;

    if (dibujo.altoVisible < altoTrazo) {
      dibujo.altoVisible += dibujo.velocidad;
    }

    let alturaActual = min(dibujo.altoVisible, altoTrazo);
    let proporcionVisible = alturaActual / altoTrazo;
    let altoFuente = imagenTrazo.height * proporcionVisible;

    push();
    translate(dibujo.x, dibujo.y);
    rotate(radians(dibujo.angulo));

    if (dibujo.direccion === "curva") {
      shearX(radians(dibujo.curva * 0.15));
    }

    tint(255, dibujo.opacidad);
    image(
      imagenTrazo,
      0,
      -altoTrazo / 2 + alturaActual / 2,
      anchoTrazo,
      alturaActual,
      0,
      0,
      imagenTrazo.width,
      altoFuente
    );
    noTint();
    pop();

    if (dibujo.desvaneciendo) {
      dibujo.opacidad -= 8;

      if (dibujo.opacidad <= 0) {
        noTint();
        imageMode(CORNER);
        dibujos.splice(i, 1);
        imageMode(CENTER);
      }
    }
  }

  noTint();
  imageMode(CORNER);
}

function mostrarDebug() {
  push();
  imageMode(CORNER);
  noStroke();
  noTint();
  fill(0, 175);
  rect(16, 16, 450, 630, 6);

  fill(255);
  textSize(15);
  text("A/click: activar audio | T: test trazos | D: debug", 28, 42);
  text("R: desvanecer | F/espacio: fondo | X: reiniciar", 28, 68);
  text("audioActivo: " + audioActivo, 28, 100);
  text("amplitud: " + nf(amplitud, 1, 4), 28, 126);
  text("amp suavizada: " + nf(amplitudSuavizada, 1, 4), 28, 152);
  text("graves: " + int(graves), 28, 178);
  text("medios: " + int(medios), 28, 204);
  text("agudos: " + int(agudos), 28, 230);
  text("sibilantes: " + int(sibilantes), 28, 256);
  text("dif bandas: " + int(diferenciaBandas), 28, 282);
  text("duracion: " + int(duracionSonido) + " ms", 28, 308);
  text("estadoSonoro: " + estadoSonoro, 28, 334);
  text("estado candidato: " + estadoCandidato, 28, 360);
  text("tiempo candidato: " + int(tiempoEstadoCandidato) + " / " + tiempoParaDefinirFamilia + " ms", 28, 386);
  text("aplauso detectado: " + aplausoDetectado, 28, 412);
  text("subida amp: " + nf(incrementoAmplitud, 1, 4), 28, 438);
  text("dibujos: " + dibujos.length, 28, 464);
  text("familiaDefinida: " + familiaDefinida, 28, 490);
  text("modoCompositivo: " + modoCompositivo, 28, 516);
  text("anguloRector: " + int(anguloRector), 28, 542);
  text("nucleo: " + int(nucleoX) + ", " + int(nucleoY), 28, 568);
  text("desviacion: " + int(desviacionX) + ", " + int(desviacionY), 28, 594);
  text("fondo/transicion: " + fondoActual + " / " + nf(transicionFondo, 1, 2), 28, 620);

  let barra = map(amplitudSuavizada, 0, 0.12, 0, 360, true);
  fill(120, 220, 255);
  rect(28, 632, barra, 10);
  pop();
}

function reiniciarObra() {
  dibujos = [];
  fondoActual = 0;
  fondoAnterior = 0;
  transicionFondo = 1;
  duracionSonido = 0;
  estadoSonoro = audioActivo ? "silencio" : "mic inactivo";
  inicializarComposicion();
}

function reiniciarObraPorAplauso() {
  dibujos = [];
  fondoActual = 0;
  fondoAnterior = 0;
  transicionFondo = 1;
  duracionSonido = 0;
  estadoSonoro = "silencio";
  inicializarComposicion();
  aplausoDetectado = true;

  if (mostrarLogsTrazos) {
    console.log("aplauso detectado: reinicio total de obra");
  }
}
