export const CATALOGO = [
  // ===================== CARDIO =====================
  { name: 'ESTEIRA', icon: 'esteira', exercises: ['Caminhada inclinada', 'Corrida leve', 'HIIT na esteira'] },
  { name: 'BICICLETA', icon: 'bicicleta', exercises: ['Pedal leve', 'Pedal intenso (spinning)'] },
  { name: 'ELÍPTICO', icon: 'eliptico', exercises: ['Elíptico ritmo constante', 'Elíptico intervalado'] },
  { name: 'REMO ERGÔMETRO', icon: 'remo', exercises: ['Remo contínuo', 'Remo intervalado'] },
  { name: 'ESCADA (STAIRMASTER)', icon: 'escada', exercises: ['Subida contínua', 'Subida intervalada'] },

  // ===================== 1. ABDOMINAL =====================
  { name: 'BANCO ABDOMINAL', icon: 'abdome', exercises: ['Abdominal', 'Elevação de pernas', 'Abdominal superior', 'Abdominal inferior', 'Abdominal oblíquo'] },
  { name: 'ABDOMINAL NA POLIA', icon: 'polia', exercises: ['Abdominal supra na polia (crunch)'] },
  { name: 'MESA ROMANA', icon: 'romana', exercises: ['Hiperextensão lombar'] },

  // ===================== 2. INFERIORES =====================
  { name: 'LEG PRESS HORIZONTAL', icon: 'perna', exercises: ['Leg press horizontal (180°)', 'Leg press horizontal - pés baixos (quadríceps)', 'Leg press horizontal - pés altos (glúteos/posterior)', 'Leg press horizontal - pés afastados (adutores)', 'Panturrilha no leg press horizontal'] },
  { name: 'LEG PRESS VERTICAL', icon: 'perna', exercises: ['Leg press vertical (90°)', 'Leg press vertical - pés baixos (quadríceps)', 'Leg press vertical - pés altos (glúteos/posterior)', 'Leg press vertical - pés afastados (adutores)', 'Panturrilha no leg press vertical'] },
  { name: 'LEG PRESS 45°', icon: 'perna', exercises: ['Leg press 45° (inclinado)', 'Leg press 45° - pés baixos (quadríceps)', 'Leg press 45° - pés altos (glúteos/posterior)', 'Leg press 45° - pés afastados (adutores)', 'Panturrilha no leg press 45°'] },
  { name: 'CADEIRA EXTENSORA', icon: 'perna', exercises: ['Extensão de joelho'] },
  { name: 'CADEIRA FLEXORA', icon: 'perna', exercises: ['Flexão de joelho'] },
  { name: 'MESA FLEXORA', icon: 'perna', exercises: ['Flexão de joelho deitado'] },
  { name: 'CADEIRA ADUTORA', icon: 'perna', exercises: ['Adução de quadril'] },
  { name: 'CADEIRA ABDUTORA', icon: 'perna', exercises: ['Abdução de quadril'] },
  { name: 'HACK MACHINE', icon: 'hack', exercises: ['Agachamento hack'] },
  { name: 'PANTURRILHA EM PÉ', icon: 'perna', exercises: ['Elevação de panturrilha em pé'] },
  { name: 'PANTURRILHA SENTADO', icon: 'perna', exercises: ['Gêmeos sentado'] },
  { name: 'GLÚTEO NA POLIA (COICE)', icon: 'gluteo', exercises: ['Coice na polia', 'Glúteo 4 apoios na polia'] },
  { name: 'GLÚTEO MÁQUINA', icon: 'gluteo', exercises: ['Glúteo na máquina'] },

  // ===================== 3. PEITORAL =====================
  { name: 'SUPINO RETO', icon: 'supino', exercises: ['Supino reto máquina', 'Supino reto com halteres'] },
  { name: 'SUPINO INCLINADO', icon: 'supino', exercises: ['Supino inclinado máquina', 'Supino inclinado com halteres'] },
  { name: 'SUPINO DECLINADO', icon: 'supino', exercises: ['Supino declinado máquina', 'Supino declinado com halteres'] },
  { name: 'PECK DECK (VOADOR)', icon: 'peck', exercises: ['Crucifixo máquina (peck deck)', 'Crucifixo inclinado', 'Crucifixo reto'] },

  // ===================== 4. DORSAIS =====================
  { name: 'PUXADA', icon: 'puxada', exercises: ['Puxada frente', 'Puxada triângulo', 'Puxada pegada supinada', 'Puxada alta'] },
  { name: 'REMADA BAIXA', icon: 'remada', exercises: ['Remada baixa', 'Remada unilateral'] },
  { name: 'REMADA CAVALINHO', icon: 'remada', exercises: ['Remada cavalinho'] },
  { name: 'GRAVITON (PULLEY ASSISTIDO)', icon: 'graviton', exercises: ['Barra fixa assistida', 'Paralelas assistidas'] },

  // ===================== 5. DELTOIDES =====================
  { name: 'DESENVOLVEDORA', icon: 'desenvolvedora', exercises: ['Desenvolvimento máquina', 'Desenvolvimento central'] },
  { name: 'DELTOIDE POSTERIOR (VOADOR INVERSO)', icon: 'voadorInverso', exercises: ['Elevação posterior máquina', 'Crucifixo inverso'] },
  { name: 'ABDUÇÃO DE OMBRO (LATERAL)', icon: 'ombro', exercises: ['Abdução 45°', 'Elevação lateral máquina', 'Remada alta na máquina'] },

  // ===================== 6. BÍCEPS =====================
  { name: 'BANCO SCOTT', icon: 'scott', exercises: ['Rosca Scott com barra', 'Rosca Scott com halter'] },

  // ===================== 7. ANTEBRAÇOS =====================
  { name: 'ANTEBRAÇO', icon: 'barra', exercises: ['Rosca inversa'] },

  // ===================== 8. TRÍCEPS =====================
  { name: 'CROSS OVER', icon: 'cross', exercises: ['Tríceps na polia', 'Tríceps na polia corda','Crucifixo na polia', 'Face pull', 'Rosca na polia', 'Tríceps extensão de cotovelo', 'Tríceps invertido na polia', 'Tríceps diagonal na polia', 'Rosca direta na polia', 'Rosca unilateral na polia', 'Rosca martelo na polia (corda)', 'Rosca inversa na polia (pegada pronada)', 'Rosca 21 na polia', 'Rosca scott na polia'] },
  { name: 'MESA PARA TRÍCEPS TESTA', icon: 'testa', exercises: ['Tríceps testa com barra'] },

  // ===================== LIVRES (halteres / barra) =====================
  { name: 'HALTERES', icon: 'halter', exercises: ['Rosca direta', 'Rosca concentrada', 'Rosca alternada', 'Rosca martelo', 'Rosca inversa com halteres', 'Rosca spider', 'Rosca 21', 'Rosca em pé unilateral', 'Rosca inclinada no banco (rosca inclinado)', 'Elevação lateral', 'Elevação frontal', 'Remada alta', 'Agachamento goblet', 'Tríceps francês', 'Stiff com halteres', 'Encolhimento de trapézio'] },
  { name: 'BARRA / ANILHAS', icon: 'barra', exercises: ['Agachamento livre', 'Levantamento terra', 'Supino com barra', 'Encolhimento com barra'] },
]
