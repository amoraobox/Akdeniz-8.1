/**
 * Sistema Akdeniz para Foundry VTT
 * Versión 10.0 - Corrección de Localización y Carga de Listas
 */

import TalentoData from "./module/data/talento-data.mjs";

Hooks.once('init', async function() {
    console.log('Akdeniz | Inicializando el sistema de juego Akdeniz');

    CONFIG.AKDENIZ = {};

    // 1. REGISTRO DE DATA MODELS
    CONFIG.Item.dataModels = {
        talento: TalentoData
    };

    // 2. LISTAS DE OPCIONES (Ajustadas para coincidir con es.json)
    CONFIG.AKDENIZ.listaPlanteamientos = {
        "brusco": "AKDENIZ.brusco",
        "cauto": "AKDENIZ.cauto",
        "instintivo": "AKDENIZ.instintivo",
        "rapido": "AKDENIZ.rapido",
        "calculado": "AKDENIZ.calculado",
        "sutil": "AKDENIZ.sutil"
    };
    
    CONFIG.AKDENIZ.listaHabilidades = {
        "aptitudFisica": "AKDENIZ.aptitudFisica",
        "agilidad": "AKDENIZ.agilidad",
        "combate": "AKDENIZ.combate",
        "conocimientos": "AKDENIZ.conocimientos",
        "logica": "AKDENIZ.logica",
        "social": "AKDENIZ.social"
    };

    // 3. CARGA DE PARTIALS
    return foundry.applications.handlebars.loadTemplates([
        "systems/akdeniz/templates/chat-roll-card.html",
        "systems/akdeniz/templates/dialog-dice-manipulation.html"
    ]);
});

// ==================================================================
// LISTENER PARA BOTONES DE CHAT (Trío Mixto)
// ==================================================================
Hooks.on('renderChatMessage', (message, html) => {
    html.find('.akdeniz-trio-choice').click(async ev => {
        ev.preventDefault();
        const button = $(ev.currentTarget);
        const choice = button.data('choice'); 
        
        const speaker = message.speaker;
        const actor = game.actors.get(speaker.actor);

        if (!actor || !actor.isOwner) {
            ui.notifications.warn("No tienes permiso para modificar este actor.");
            return;
        }

        const currentEstres = actor.system.estres.value;
        const maxEstres = actor.system.estres.max;
        let nuevoEstres = currentEstres;
        let mensajeFeedback = "";

        if (choice === 'oportunidad') {
            nuevoEstres = Math.min(maxEstres, currentEstres + 1);
            mensajeFeedback = "<span style='color:blue'><strong>Oportunidad</strong> (+1 Estrés).</span>";
        } else if (choice === 'adversidad') {
            nuevoEstres = Math.max(0, currentEstres - 1);
            mensajeFeedback = "<span style='color:red'><strong>Adversidad</strong> (-1 Estrés).</span>";
        }

        if (nuevoEstres !== currentEstres) {
            await actor.update({ 'system.estres.value': nuevoEstres });
        }

        button.closest('.info-box.trio').html(`<div style="text-align:center;">${mensajeFeedback}</div>`);
    });
});

// ==================================================================
// CLASE ACTOR
// ==================================================================
class AkdenizActor extends foundry.documents.Actor {
    prepareDerivedData() {
        super.prepareDerivedData();
        const system = this.system;
        let mods = { vida: 0, estres: 0, desafio: 0, dano: 0 };

        if (this.type === 'pnj' || this.type === 'esbirro') {
            for (const item of this.items) {
                if (item.type === 'talento' && item.system.tipoTalento === 'PNJ') {
                    const fx = item.system.efectosPNJ;
                    if (fx?.desafio?.activo && fx?.desafio?.habilitado) mods.desafio += (fx.desafio.valor || 0);
                    if (fx?.vida?.activo && fx?.vida?.habilitado) mods.vida += (fx.vida.valor || 0);
                    if (fx?.estres?.activo && fx?.estres?.habilitado) mods.estres += (fx.estres.valor || 0);
                    if (fx?.dano?.activo && fx?.dano?.habilitado) mods.dano += (fx.dano.valor || 0);
                }
            }
            if (system.dificultad !== undefined) system.dificultad += mods.desafio;
            system.bonoDano = mods.dano;
        }

        if (this.type === 'personaje') {
            const ag = system.caracteristicas.habilidades.agilidad || 0;
            const af = system.caracteristicas.habilidades.aptitudFisica || 0;
            system.vida.max = 10 + ag + af;
            const calc = system.caracteristicas.planteamientos.calculado || 0;
            const log = system.caracteristicas.habilidades.logica || 0;
            system.estres.max = 5 + calc + log;
        }
    }
}
CONFIG.Actor.documentClass = AkdenizActor;

// ==================================================================
// CLASE ACTOR SHEET
// ==================================================================
class AkdenizBaseActorSheet extends foundry.appv1.sheets.ActorSheet {
    get template() { return `systems/akdeniz/templates/actor-${this.actor.type}-sheet.html`; }
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["akdeniz", "sheet", "actor"],
            width: 800, height: 700,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
        });
    }
    async getData(options) {
        const context = await super.getData(options);
        context.system = this.actor.system;
        context.items = Array.from(this.actor.items || []);
        context.CONFIG = CONFIG; // Necesario para acceder a CONFIG.AKDENIZ en el HTML
        return context;
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.item-edit').click(ev => {
            const id = ev.currentTarget.closest(".item").dataset.itemId;
            this.actor.items.get(id).sheet.render(true);
        });
        html.find('.item-delete').click(this._onItemDelete.bind(this));
        html.find('.item-add, .item-create').click(this._onEmbeddedCreate.bind(this));
        html.find('.arrow-control').click(this._onRecursoChange.bind(this));
        html.find('.roll-habilidad').click(this._onRollSetup.bind(this));
    }

    async _onEmbeddedCreate(event) {
        event.preventDefault();
        const type = event.currentTarget.dataset.type;
        const newKey = foundry.utils.randomID();
        let path = (type === "especialidad") ? "especialidades" : (type === "habilidad" ? "habilidades" : "planteamientos");
        await this.actor.update({ [`system.caracteristicas.${path}.${newKey}`]: { nombre: 'Nuevo', valor: 1 } });
    }

    async _onItemDelete(event) {
        event.preventDefault();
        const element = event.currentTarget.closest('[data-item-id], [data-key]');
        if (element.dataset.itemId) return this.actor.deleteEmbeddedDocuments("Item", [element.dataset.itemId]);
        const key = element.dataset.key;
        const type = element.dataset.type;
        let path = (type === "especialidad") ? "especialidades" : (type === "habilidad" ? "habilidades" : "planteamientos");
        await this.actor.update({ [`system.caracteristicas.${path}.-=${key}`]: null });
    }

    async _onRecursoChange(event) {
        event.preventDefault();
        const { action, target } = event.currentTarget.dataset;
        let val = foundry.utils.getProperty(this.actor, target) || 0;
        let update = (action === "up") ? val + 1 : Math.max(0, val - 1);
        await this.actor.update({ [target]: update });
    }

    async _onRollSetup(event) {
        const dataset = event.currentTarget.dataset;
        const hKey = dataset.rollKey;
        const hVal = this.actor.system.caracteristicas.habilidades[hKey] || 0;
        const hNom = game.i18n.localize(`AKDENIZ.${hKey}`);

        const content = await foundry.applications.handlebars.renderTemplate("systems/akdeniz/templates/dialog-roll.html", {
            actor: this.actor,
            planteamientos: this.actor.system.caracteristicas.planteamientos,
            especialidades: Object.values(this.actor.system.caracteristicas.especialidades || {}),
            armas: this.actor.items.filter(i => i.type === 'arma'),
            talentos: this.actor.items.filter(i => i.type === 'talento'),
            habilidadValorBase: hVal
        });

        new Dialog({
            title: `Tirada de ${hNom}`,
            content: content,
            buttons: {
                roll: { label: 'Lanzar', callback: html => this._executeRoll(html, hKey, hVal, hNom) }
            },
            default: 'roll'
        }).render(true);
    }

    async _executeRoll(html, hKey, hVal, hNom) {
        const form = html.find('form')[0];
        const pVal = parseInt(html.find('#select-planteamiento option:selected').data('valor')) || 0;
        const pNom = html.find('#select-planteamiento option:selected').text();
        const dTarea = parseInt(form.dificultad.value) || 0;
        const espNivel = parseInt(form.especialidad.value) || 0;
        const extra = parseInt(form.dadosExtra.value) || 0;
        const mH = parseInt(form.modHabilidad.value) || 0;
        const mP = parseInt(form.modPlanteamiento.value) || 0;

        const roll = new Roll(`${Math.max(0, pVal + mP + extra)}d6 + ${Math.max(0, hVal + mH)}d12`);
        await roll.evaluate();
        this._finishRollProcessing({ roll, dTarea, espNivel, armaId: form.armaSeleccionada.value, talentoId: form.talentoSeleccionado.value, hNom, pNom });
    }

    async _finishRollProcessing(data) {
        const { roll, dTarea, espNivel, armaId, talentoId, hNom, pNom } = data;
        let exitos = 0, ops = 0, advs = 0, pTrios = 0, mTrios = 0;
        const conteo = {};
        const status = {};

        roll.terms[0].results.forEach(r => { 
            conteo[r.result] = conteo[r.result] || { d6:0, d12:0 }; 
            conteo[r.result].d6++; 
            if (r.result >= 5) exitos++;
        });
        roll.terms[2].results.forEach(r => { 
            conteo[r.result] = conteo[r.result] || { d6:0, d12:0 }; 
            conteo[r.result].d12++; 
            if (r.result === 12) exitos += 2; else if (r.result >= (10 - espNivel)) exitos++;
        });

        for (let n in conteo) {
            let total = conteo[n].d6 + conteo[n].d12;
            if (total >= 3) {
                if (conteo[n].d6 === total || conteo[n].d12 === total) { pTrios++; status[n] = 'trio-pure'; }
                else { mTrios++; status[n] = 'trio-mixed'; }
            } else if (total === 2) {
                if (conteo[n].d6 === 2 || conteo[n].d12 === 2) { ops++; status[n] = 'oportunidad'; }
                else { advs++; status[n] = 'adversidad'; }
            }
        }

        let msgPure = "";
        if (pTrios > 0) {
            ops += pTrios;
            const cur = this.actor.system.estres.value;
            if (cur > 0) await this.actor.update({ 'system.estres.value': Math.max(0, cur - 1) });
            msgPure = `<div class="info-box pure" style="border:2px solid purple; padding:5px; margin-top:5px; background:rgba(128,0,128,0.1);">
                <strong>¡TRÍO PURO!</strong><br>• +1 Oportunidad (añadida)<br>• -1 Estrés (aplicado)<br>• +1 Susurro
            </div>`;
        }

        const buildDice = (results, face) => results.map(r => {
            let ex = face === 6 ? r.result >= 5 : (r.result === 12 || r.result >= (10 - espNivel));
            return `<div class="die-shape die-d${face} ${ex ? 'exito' : 'no-exito'}"><span class="numero ${status[r.result] || ''}">${r.result}</span></div>`;
        }).join('');

        const dEx = Math.max(0, exitos - dTarea);
        let dano = 0;
        if (exitos >= dTarea && armaId) {
            const a = this.actor.items.get(armaId);
            const cat = a?.system.categoriaDano || "";
            if (cat === "Sin arma") dano = dEx + ops;
            else if (cat === "Pequeña") dano = 1 + dEx;
            else if (cat === "Espada") dano = 2 + dEx;
            else if (cat === "Fuego") dano = 3 + dEx + ops;
            else if (cat === "Explosion") dano = 4 + dEx + (ops * 2);
        }

        const chatData = {
            actor: this.actor, habilidadNombre: hNom, planteamientoUsado: pNom,
            dadosD6HTML: buildDice(roll.terms[0].results, 6),
            dadosD12HTML: buildDice(roll.terms[2].results, 12),
            cssResultado: exitos >= dTarea ? "exito" : "fallo",
            textoResultado: exitos >= dTarea ? "ÉXITO" : "FALLO",
            exitos, dificultad: dTarea, danoCalculado: dano, mostrarDano: dano > 0,
            mostrarResumenEfectos: (ops > 0 || advs > 0 || mTrios > 0 || pTrios > 0),
            oportunidades: ops, adversidades: advs, trios: mTrios, pureTrios: pTrios,
            mostrarOportunidades: ops > 0, mostrarAdversidades: advs > 0, mostrarTrios: (mTrios > 0 || pTrios > 0),
            mensajeExtra: msgPure
        };

        const content = await foundry.applications.handlebars.renderTemplate("systems/akdeniz/templates/chat-roll-card.html", chatData);
        ChatMessage.create({ user: game.user.id, speaker: ChatMessage.getSpeaker({ actor: this.actor }), content, style: CONST.CHAT_MESSAGE_STYLES.OTHER });
    }
}

// ==================================================================
// REGISTRO
// ==================================================================
Hooks.once('ready', () => {
    foundry.documents.collections.Actors.registerSheet("akdeniz", AkdenizBaseActorSheet, { makeDefault: true });
    Handlebars.registerHelper('eq', (a, b) => a === b);
});