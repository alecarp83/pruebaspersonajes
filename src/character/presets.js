// Presets de personaje: medidas parciales (se mezclan con SEGMENT_DEFAULTS), colores, texturas por parte, equipo y pose.
const M = (tex, color, color2, extra = {}) => ({ tex, color, color2, ...extra });
const ARMS_OUT = { hombro_L: [0, 0, 30], hombro_R: [0, 0, -30] };
const metal = (c, c2, o = {}) => M('metal', c, c2, { metalness: .9, roughness: .32, ...o });
const ghost = (op) => M('liso', '#dff1ff', '#ffffff', { opacity: op, roughness: .25 });

export const PRESETS = {
  humano: { seg: {}, colors: { piel: '#d9b08c', base: '#4a6fa5' }, parts: {}, gear: {}, pose: ARMS_OUT },

  robot: {
    seg: { cabeza: { length: .24, width: .2 }, cuello: { length: .1, width: .07 }, torso: { length: .58, width: .4 }, pelvis: { length: .16, width: .3 },
      brazo: { length: .32, width: .09 }, antebrazo: { length: .3, width: .08 }, mano: { length: .16, width: .1 },
      muslo: { length: .45, width: .13 }, pantorrilla: { length: .45, width: .11 }, pie: { length: .28, width: .12 } },
    colors: { piel: '#9aa3ad', base: '#3b4a63' },
    parts: { cabeza: metal('#c3cad2', '#6b7480', { roughness: .3 }), cuello: M('liso', '#2b2f36', '#111111'), torso: metal('#3b4a63', '#1f2a3d', { scale: 3 }),
      pelvis: metal('#2f3a50', '#1b2230'), brazo: metal('#9aa3ad', '#555c66'), antebrazo: metal('#9aa3ad', '#555c66'), mano: metal('#2b2f36', '#111111', { roughness: .4 }),
      muslo: metal('#3b4a63', '#1f2a3d'), pantorrilla: metal('#9aa3ad', '#555c66'), pie: metal('#2b2f36', '#111111'),
      hombreras: metal('#c3cad2', '#6b7480'), rodilleras: metal('#c3cad2', '#6b7480'), botas: metal('#2b2f36', '#111111') },
    gear: { hombreras: true, rodilleras: true, botas: true }, pose: ARMS_OUT,
  },

  chibi: {
    seg: { cabeza: { length: .5, width: .44 }, cuello: { length: .04, width: .1 }, torso: { length: .3, width: .28 }, pelvis: { length: .12, width: .22 },
      brazo: { length: .16, width: .09 }, antebrazo: { length: .15, width: .08 }, mano: { length: .1, width: .08 },
      muslo: { length: .2, width: .11 }, pantorrilla: { length: .2, width: .1 }, pie: { length: .2, width: .11 } },
    colors: { piel: '#f1c9a5', base: '#e86a8a' },
    parts: { torso: M('tela', '#e86a8a', '#c94c6e'), pelvis: M('tela', '#5b6bd6', '#3f4db0'), muslo: M('tela', '#5b6bd6', '#3f4db0'), pantorrilla: M('tela', '#5b6bd6', '#3f4db0'),
      botas: M('cuero', '#7a4a2a', '#4a2a14', { roughness: .7 }), cinturon: M('cuero', '#f2c14e', '#b8902f', { roughness: .6 }) },
    gear: { botas: true, cinturon: true }, pose: ARMS_OUT,
  },

  corpulento: {
    seg: { cabeza: { length: .26, width: .22 }, cuello: { length: .08, width: .16 }, torso: { length: .6, width: .55 }, pelvis: { length: .22, width: .42 },
      brazo: { length: .32, width: .16 }, antebrazo: { length: .28, width: .14 }, mano: { length: .19, width: .11 },
      muslo: { length: .44, width: .2 }, pantorrilla: { length: .42, width: .15 }, pie: { length: .28, width: .13 } },
    colors: { piel: '#d9a77c', base: '#6b5a3c' },
    parts: { torso: M('tela', '#6b5a3c', '#4a3e28'), pelvis: M('tela', '#3e4a63', '#2b3347'), muslo: M('tela', '#3e4a63', '#2b3347'), pantorrilla: M('tela', '#3e4a63', '#2b3347'),
      cinturon: M('cuero', '#4a3320', '#2a1b10', { roughness: .7 }), botas: M('cuero', '#3a2a1c', '#1f150c', { roughness: .7 }) },
    gear: { cinturon: true, botas: true }, pose: { hombro_L: [0, 0, 38], hombro_R: [0, 0, -38] },
  },

  orco: {
    seg: { cabeza: { length: .27, width: .24 }, cuello: { length: .07, width: .17 }, torso: { length: .62, width: .52 }, pelvis: { length: .2, width: .4 },
      brazo: { length: .36, width: .17 }, antebrazo: { length: .33, width: .15 }, mano: { length: .21, width: .12 },
      muslo: { length: .42, width: .18 }, pantorrilla: { length: .4, width: .14 }, pie: { length: .3, width: .13 } },
    colors: { piel: '#5b8a3a', base: '#6a4a2a' },
    parts: { cabeza: M('piel', '#5b8a3a', '#2f4d1f', { roughness: .9 }), cuello: M('piel', '#5b8a3a', '#2f4d1f', { roughness: .9 }),
      brazo: M('piel', '#5b8a3a', '#2f4d1f', { roughness: .9 }), antebrazo: M('piel', '#5b8a3a', '#2f4d1f', { roughness: .9 }), mano: M('piel', '#5b8a3a', '#2f4d1f', { roughness: .9 }),
      torso: M('cuero', '#6a4a2a', '#3a2412'), pelvis: M('cuero', '#6a4a2a', '#3a2412'), muslo: M('cuero', '#4a3320', '#2a1b10'), pantorrilla: M('cuero', '#4a3320', '#2a1b10'),
      hombreras: metal('#6b6f78', '#2e3036', { metalness: .7, roughness: .6 }), cinturon: M('cuero', '#3a2412', '#1f1209'), botas: M('cuero', '#2a1b10', '#120a05'), guantes: M('cuero', '#3a2412', '#1f1209') },
    gear: { hombreras: true, cinturon: true, botas: true, guantes: true },
    pose: { hombro_L: [0, 0, 40], hombro_R: [0, 0, -40], cintura: [12, 0, 0], cabeza: [10, 0, 0] },
  },

  zombie: {
    seg: { brazo: { width: .075 }, antebrazo: { width: .065 } },
    colors: { piel: '#7d9b6b', base: '#4a4640' },
    parts: { cabeza: M('piel', '#7d9b6b', '#46563e'), cuello: M('piel', '#7d9b6b', '#46563e'), brazo: M('piel', '#7d9b6b', '#46563e'), antebrazo: M('piel', '#7d9b6b', '#46563e'), mano: M('piel', '#7d9b6b', '#46563e'),
      torso: M('tela', '#5a5f4a', '#33362a'), pelvis: M('tela', '#4a4640', '#2c2a26'), muslo: M('tela', '#4a4640', '#2c2a26'), pantorrilla: M('tela', '#4a4640', '#2c2a26'), pie: M('cuero', '#2f2a24', '#16130f') },
    gear: {},
    pose: { hombro_L: [85, 0, 8], hombro_R: [85, 0, -8], codo_L: [25, 0, 0], codo_R: [25, 0, 0], cintura: [14, 0, 0], cuello: [22, 0, 0], cabeza: [8, 0, 10] },
  },

  fantasma: {
    seg: { torso: { length: .6 }, cabeza: { length: .24, width: .19 }, brazo: { width: .09 } },
    colors: { piel: '#dff1ff', base: '#cfe4ff' },
    parts: { cabeza: ghost(.75), cuello: ghost(.7), torso: ghost(.6), brazo: ghost(.55), antebrazo: ghost(.5), mano: ghost(.45), pelvis: ghost(.4), muslo: ghost(.3), pantorrilla: ghost(.2), pie: ghost(.12) },
    gear: {}, pose: { hombro_L: [0, 0, 35], hombro_R: [0, 0, -35] },
  },

  mutante: {
    seg: { cabeza: { length: .17, width: .15 }, cuello: { length: .1, width: .12 }, torso: { length: .6, width: .5 }, pelvis: { length: .2, width: .34 },
      brazo: { length: .42, width: .2 }, antebrazo: { length: .4, width: .22 }, mano: { length: .3, width: .2 },
      muslo: { length: .4, width: .13 }, pantorrilla: { length: .5, width: .1 }, pie: { length: .3, width: .11 } },
    colors: { piel: '#7a4aa0', base: '#2f7a3a' },
    parts: { cabeza: M('piel', '#9a6ab8', '#4a2a68'), cuello: M('piel', '#9a6ab8', '#4a2a68'), torso: M('camuflaje', '#2f7a3a', '#7a4aa0'),
      brazo: M('camuflaje', '#7a4aa0', '#2f7a3a'), antebrazo: M('camuflaje', '#7a4aa0', '#2f7a3a'), mano: M('piel', '#8a2f2f', '#4a1010'),
      muslo: M('piel', '#5d8a3a', '#2f4d1f'), pantorrilla: M('piel', '#5d8a3a', '#2f4d1f'), hombreras: metal('#6b6f78', '#2e3036', { metalness: .7, roughness: .5 }) },
    gear: { hombreras: true }, pose: { hombro_L: [0, 0, 26], hombro_R: [0, 0, -26] },
  },
};
