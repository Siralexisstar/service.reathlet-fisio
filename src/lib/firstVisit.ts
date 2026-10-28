// Public form options and wire types only. Server configuration never belongs here.
export const availabilityOptions = ['Sin preferencia', 'Por la mañana', 'Al mediodía', 'Por la tarde']
export const regionOptions = ['Cuello / cervicales', 'Hombro / brazo', 'Espalda / zona lumbar', 'Cadera', 'Rodilla', 'Tobillo / pie', 'Varias zonas', 'Valoración general']
export const durationOptions = ['Menos de una semana', 'Entre 1 y 4 semanas', 'Entre 1 y 3 meses', 'Más de 3 meses', 'No tengo molestias actualmente']

export type FullRequest = {
  version: 2
  tipoPaciente: 'NUEVO'
  nombre: string
  email: string
  website?: string
  administrativo: { telefono: string; preferenciaHoraria: string; canal: 'EMAIL' }
  clinico: {
    zona: string
    duracion: string
    motivo: string
    dolorActual: number | null
    antecedentes: string
    medicacionAlergias: string
  }
  consentimientos: { privacidad: boolean; salud: boolean }
  firma: { tipo: 'ESCRITA'; texto: string } | { tipo: 'DIBUJADA'; png: string }
}
