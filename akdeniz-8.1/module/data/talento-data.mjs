/**
 * Definición del Modelo de Datos para Items de tipo "Talento"
 * Compatible con Foundry VTT V13
 */
export default class TalentoData extends foundry.abstract.TypeDataModel {
    
    static defineSchema() {
        const fields = foundry.data.fields;

        return {
            // Campos Generales
            description: new fields.HTMLField(),
            
            // Selector de tipo: AQUI HE AÑADIDO TUS TIPOS ORIGINALES + PNJ
            tipoTalento: new fields.StringField({ 
                required: true, 
                initial: "General",
                choices: ["General", "Origen", "Oficio", "Capacidad", "Plegaria", "PNJ"]
            }),
            
            // Campos de compatibilidad (para no romper datos viejos)
            coste: new fields.NumberField({ initial: 0 }),
            tipo: new fields.StringField({ initial: "" }),

            // Estructura exclusiva para PNJ
            efectosPNJ: new fields.SchemaField({
                
                desafio: new fields.SchemaField({
                    activo: new fields.BooleanField({ initial: false }),
                    usos: new fields.StringField({ initial: "∞" }),
                    valor: new fields.NumberField({ initial: 0, integer: true }),
                    habilitado: new fields.BooleanField({ initial: true })
                }),

                vida: new fields.SchemaField({
                    activo: new fields.BooleanField({ initial: false }),
                    usos: new fields.StringField({ initial: "∞" }),
                    valor: new fields.NumberField({ initial: 0, integer: true }),
                    habilitado: new fields.BooleanField({ initial: true })
                }),

                estres: new fields.SchemaField({
                    activo: new fields.BooleanField({ initial: false }),
                    usos: new fields.StringField({ initial: "∞" }),
                    valor: new fields.NumberField({ initial: 0, integer: true }),
                    habilitado: new fields.BooleanField({ initial: true })
                }),

                dano: new fields.SchemaField({
                    activo: new fields.BooleanField({ initial: false }),
                    usos: new fields.StringField({ initial: "∞" }),
                    valor: new fields.NumberField({ initial: 0, integer: true }),
                    habilitado: new fields.BooleanField({ initial: true })
                })
            })
        };
    }
}