import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCMh97llmGnNLcWFHjlkNF0KogSZ9u-Qrs",
  authDomain: "tutifruti-dvp.firebaseapp.com",
  databaseURL: "https://tutifruti-dvp-default-rtdb.firebaseio.com",
  projectId: "tutifruti-dvp",
  storageBucket: "tutifruti-dvp.firebasestorage.app",
  messagingSenderId: "912284829549",
  appId: "1:912284829549:web:e69340663fd7b4dc0f7c64"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const categorias = ['nombre', 'lugar', 'comida', 'cosa', 'animal', 'pelicula'];
let currentRoom = null;
let myUser = null;
let soyCreador = false;

let timerInterval;

// --- FUNCIONES DE SALA ---

window.crearPartida = function() {
    const name = document.getElementById('username').value;
    if(!name) return alert("Ingresá tu nombre primero");
    
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    currentRoom = roomCode;
    myUser = name;
    soyCreador = true;

    // 1. Creamos la sala en Firebase
    set(ref(db, 'rooms/' + roomCode), {
        status: "waiting",
        creator: name,
        letra: "",
        timestamp: Date.now()
    });

    // 2. Nos unimos automáticamente como jugador
    update(ref(db, `rooms/${roomCode}/players/${name}`), { score: 0 });

    // 3. Saltamos directo a la pantalla de espera
    irAPantallaEspera(roomCode);
    escucharCambios(roomCode);
};

window.unirsePartida = function() {
    const name = document.getElementById('username').value;
    const roomCode = document.getElementById('roomCode').value.toUpperCase();
    if(!name || !roomCode) return alert("Faltan datos");

    currentRoom = roomCode;
    myUser = name;
    soyCreador = false; // Por las dudas reseteamos

    update(ref(db, `rooms/${roomCode}/players/${name}`), { score: 0 });
    
    irAPantallaEspera(roomCode);
    escucharCambios(roomCode);
};

function irAPantallaEspera(code) {
    document.getElementById('lobby').classList.add('hidden');
    document.getElementById('waiting-screen').classList.remove('hidden');
    document.getElementById('waiting-status').innerText = "Sala: " + code;
}

// --- LÓGICA DEL JUEGO (Punto 3) ---

window.iniciarJuego = function() {
    const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let giros = 0;
    
    // Deshabilitamos el botón para que no le den mil veces
    const btn = document.querySelector('#btn-iniciar-contenedor button');
    if(btn) btn.disabled = true;

    const intervaloVisual = setInterval(() => {
        const letraTemp = letras[Math.floor(Math.random() * letras.length)];
        // Mostramos la animación localmente en el botón o un título
        update(ref(db, 'rooms/' + currentRoom), {
            letraSorteo: letraTemp,
            status: "selecting" // Nuevo estado intermedio
        });
        // document.getElementById('waiting-msg').innerText = "Sorteando letra: " + letraTemp;
        giros++;
        
        if (giros > 20) { 
            clearInterval(intervaloVisual);
            const letraAzar = letras[Math.floor(Math.random() * letras.length)];
            
            // RECIEN ACÁ actualizamos Firebase para que todos entren al juego
            update(ref(db, 'rooms/' + currentRoom), {
                status: "playing",
                letra: letraAzar,
                timeLeft: 300 // 5 minutos
            });
            iniciarContador(300);
        }
    }, 100);
};

function iniciarContador(segundos) {
    let tiempo = segundos;
    timerInterval = setInterval(() => {
        tiempo--;
        // Actualizamos en la BD para que todos lo vean
        update(ref(db, 'rooms/' + currentRoom), { timeLeft: tiempo });

        if (tiempo <= 0) {
            clearInterval(timerInterval);
            window.presionarBasta(); // Se termina el tiempo
        }
    }, 1000);
}

let ultimoEmojiTime = 0;

function escucharCambios(roomCode) {
    onValue(ref(db, 'rooms/' + roomCode), (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        // --- 1. LÓGICA DEL EMOJI ---
        if (data.reaccion) {
            const el = document.getElementById('emoji-display');
            el.innerText = data.reaccion.msg;
            el.classList.add('show');
            
            // Cada vez que llega una reacción, reseteamos el cronómetro de desaparición
            if (emojiTimer) clearTimeout(emojiTimer);
            emojiTimer = setTimeout(() => {
                el.classList.remove('show');
            }, 2000);
        }

        // --- 2. RELOJ ---
        const displayTimer = document.getElementById('timer');
        if (data.timeLeft !== undefined && displayTimer) {
            const min = Math.floor(data.timeLeft / 60);
            const seg = data.timeLeft % 60;
            displayTimer.innerText = `${min}:${seg < 10 ? '0' : ''}${seg}`;
        }

        // --- 3. ESTADOS ---

        // ESPERA: Mostrar lista de jugadores
        if (data.status === "waiting" || data.status === "selecting") {
            if (data.players) {
                const nombres = Object.keys(data.players).join(", ");
                document.getElementById('waiting-msg').innerHTML = `<b>Jugadores:</b> ${nombres}`;
            }
            if (soyCreador) {
                document.getElementById('btn-iniciar-contenedor').innerHTML = 
                    `<button class="btn-primary" onclick="iniciarJuego()">¡EMPEZAR AHORA!</button>`;
            }
        }

        // --- 1. LÓGICA DEL EMOJI (Corregida para evitar bucle) ---
        if (data.reaccion && data.reaccion.timestamp !== ultimoEmojiTime) {
            const el = document.getElementById('emoji-display');
            if (el) {
                // Actualizamos nuestra marca de tiempo local
                ultimoEmojiTime = data.reaccion.timestamp;

                // Reset de animación
                el.classList.remove('animate');
                void el.offsetWidth; // Truco para reiniciar CSS
                
                el.innerText = data.reaccion.msg;
                el.classList.add('animate');

                // Limpieza automática al terminar la animación
                if (emojiTimer) clearTimeout(emojiTimer);
                emojiTimer = setTimeout(() => {
                    el.classList.remove('animate');
                }, 2500);
            }
        }

        if (data.status === "selecting") {
            document.getElementById('waiting-msg').innerText = "Sorteando letra: " + data.letraSorteo;
        }

        // JUGANDO
        if (data.status === "playing") {
            document.getElementById('lobby').classList.add('hidden');
            document.getElementById('waiting-screen').classList.add('hidden');
            document.getElementById('game-screen').classList.remove('hidden');
            document.getElementById('display-letra').innerText = "Letra: " + data.letra;
        }

        // FINALIZADO
        if (data.status === "finished") {
            if (timerInterval) clearInterval(timerInterval);
            finalizarEscritura();
            
            if (soyCreador) {
                // Ponemos el botón directamente en la pantalla de juego
                document.getElementById('admin-actions-game').innerHTML = 
                    `<button class="btn-primary" style="background:#2ed573" onclick="calcularResultados()">CALCULAR RESULTADOS</button>`;
            }
        }

        // RESULTADOS
        if (data.status === "results") {
            document.getElementById('game-screen').classList.add('hidden');
            document.getElementById('results-screen').classList.remove('hidden');
            
            // 1. Mostrar puntajes (Igual que antes)
            let htmlPuntos = "";
            for (let jugador in data.finalScores) {
                htmlPuntos += `<p><span>👤 ${jugador}</span> <strong>${data.finalScores[jugador]} pts</strong></p>`;
            }
            document.getElementById('lista-puntajes').innerHTML = htmlPuntos;

            // 2. Mostrar Panel de Auditoría SOLO al Admin
            if (soyCreador) {
                const panelAdmin = document.getElementById('admin-correccion-zone');
                panelAdmin.classList.remove('hidden');
                
                let htmlAdmin = "";
                const respuestas = data.respuestas;
                
                for (let jugador in respuestas) {
                    htmlAdmin += `<div style="border-bottom:1px solid #eee; padding:10px; text-align:left;">`;
                    htmlAdmin += `<strong>${jugador}:</strong><br>`;
                    
                    // Recorremos cada categoría para poner botones de anulación
                    categorias.forEach(cat => {
                        const palabra = respuestas[jugador][cat] || "(vacío)";
                        if (palabra !== "(vacío)") {
                            htmlAdmin += `<button class="btn-small-anular" onclick="anularPalabra('${jugador}', '${cat}')">
                                            ❌ ${cat}: ${palabra}
                                        </button> `;
                        }
                    });
                    htmlAdmin += `</div>`;
                }
                // Botón para aplicar cambios
                htmlAdmin += `<button class="btn-primary" style="background:var(--success); margin-top:15px;" 
                                onclick="calcularResultados()">RECALCULAR PUNTAJES</button>`;
                
                document.getElementById('lista-respuestas-admin').innerHTML = htmlAdmin;
            }
        }
    });
}

window.presionarBasta = function() {
    // Cambiamos el estado de la sala para que todos se detengan
    update(ref(db, 'rooms/' + currentRoom), {
        status: "finished"
    });
};

function finalizarEscritura() {
    console.log("Finalizando escritura...");
    const inputs = document.querySelectorAll('#inputs-container input');
    inputs.forEach(input => {
        if (input) input.disabled = true;
    });
    
    const btnBasta = document.getElementById('btn-basta');
    if (btnBasta) {
        btnBasta.innerText = "¡TIEMPO!";
        btnBasta.style.background = "#ccc";
        btnBasta.disabled = true;
    }

    enviarRespuestas();
}

function enviarRespuestas() {
    const respuestas = {};
    // Esta es la lista de categorías que el código intentará buscar
    const categoriasABuscar = ['nombre', 'lugar', 'comida', 'cosa', 'animal', 'pelicula'];
    
    categoriasABuscar.forEach(cat => {
        const el = document.getElementById(`input-${cat}`);
        if (el) {
            respuestas[cat] = el.value.trim().toLowerCase();
        } else {
            // Si no encuentra el input-comida (por ejemplo), guarda vacío y no tira error
            respuestas[cat] = ""; 
            console.warn(`Ojo: No se encontró el input con ID: input-${cat}`);
        }
    });

    console.log("Enviando respuestas a Firebase:", respuestas);
    set(ref(db, `rooms/${currentRoom}/respuestas/${myUser}`), respuestas);
}

window.calcularResultados = function() {
    onValue(ref(db, `rooms/${currentRoom}`), (snapshot) => {
        const data = snapshot.val();
        if (!data || !data.respuestas) return;

        const respuestas = data.respuestas;
        const jugadores = Object.keys(respuestas);
        const categorias = ['nombre', 'lugar', 'comida', 'cosa', 'animal', 'pelicula'];
        let puntajesFinales = {};

        jugadores.forEach(j => puntajesFinales[j] = 0);

        categorias.forEach(cat => {
            // Obtenemos respuestas de esta categoría, limpiando espacios y pasando a minúsculas
            const valoresEnEstaCat = jugadores.map(j => 
                respuestas[j][cat] ? respuestas[j][cat].trim().toLowerCase() : ""
            );

            jugadores.forEach(jugador => {
                const miRespuesta = valoresEnEstaCat[jugadores.indexOf(jugador)];

                if (!miRespuesta || miRespuesta === "") {
                    puntajesFinales[jugador] += 0; 
                } else {
                    // Contamos cuántas veces aparece esta palabra exacta en la lista de todos los jugadores
                    const repetidos = valoresEnEstaCat.filter(v => v === miRespuesta).length;
                    
                    if (repetidos > 1) {
                        puntajesFinales[jugador] += 5; // Palabra repetida
                    } else {
                        puntajesFinales[jugador] += 20; // Palabra única
                    }
                }
            });
        });

        // Actualizamos la base de datos
        update(ref(db, `rooms/${currentRoom}`), { 
            status: "results",
            finalScores: puntajesFinales 
        });
    }, { onlyOnce: true }); // Es vital el onlyOnce para que no entre en un bucle infinito
};

let emojiTimer = null; // Para controlar el emoji

window.enviarEmoji = function(emoji) {
    update(ref(db, `rooms/${currentRoom}/reaccion`), {
        msg: `${myUser}: ${emoji}`,
        timestamp: Date.now() // Esto es lo que usaremos para comparar
    });
};

window.anularPalabra = function(jugador, categoria) {
    if (!soyCreador) return;
    
    // Ponemos la palabra en blanco en la base de datos
    update(ref(db, `rooms/${currentRoom}/respuestas/${jugador}`), {
        [categoria]: ""
    }).then(() => {
        console.log("Palabra anulada. Esperando recalcular...");
    });
};