// catalog.js — arvore semantica de categorias
//
// Tese: catalogo eh **acucar de busca**, nao curadoria. Cada folha declara
// um `query` pre-formado que sera enviado ao mesmo `searchAll()` que a aba
// "Buscar" usa. O catalogo nao promete que o asset existe — promete um
// caminho rapido pra termos comuns que roteiristas usariam ("sofa", "cama",
// "geladeira") em vez de obrigar o user a saber palavra-chave em ingles.
//
// Cada folha tambem declara defaults de posicionamento (anchor, footprint)
// pras Fases 2-3 usarem. Hoje (Fase 1) esses campos sao lidos pra exibicao,
// mas nao sao aplicados no drop ainda — engine continua usando defaults.
//
// anchor: 'floor' | 'wall' | 'ceiling'
// footprint: [w, d] em tiles (1 tile = 0.5u default)

export const tree = [
  {
    id: 'living-room',
    label: 'Sala',
    icon: '🛋',
    children: [
      { id: 'sofa', label: 'Sofá', query: 'sofa', anchor: 'floor', footprint: [2, 1] },
      { id: 'armchair', label: 'Poltrona', query: 'armchair', anchor: 'floor', footprint: [1, 1] },
      { id: 'coffee-table', label: 'Mesa de centro', query: 'table', anchor: 'floor', footprint: [2, 1] },
      { id: 'tv', label: 'TV', query: 'tv', anchor: 'wall', footprint: [1, 1] },
      { id: 'tv-stand', label: 'Rack de TV', query: 'cabinet', anchor: 'floor', footprint: [2, 1] },
      { id: 'bookshelf', label: 'Estante', query: 'shelf', anchor: 'floor', footprint: [2, 1] },
      { id: 'rug', label: 'Tapete', query: 'rug', anchor: 'floor', footprint: [3, 2] },
      { id: 'floor-lamp', label: 'Luminária de pé', query: 'lamp', anchor: 'floor', footprint: [1, 1] },
      { id: 'plant', label: 'Planta', query: 'plant', anchor: 'floor', footprint: [1, 1] },
    ],
  },
  {
    id: 'kitchen',
    label: 'Cozinha',
    icon: '🍳',
    children: [
      { id: 'fridge', label: 'Geladeira', query: 'fridge', anchor: 'floor', footprint: [1, 1] },
      { id: 'stove', label: 'Fogão', query: 'stove', anchor: 'floor', footprint: [1, 1] },
      { id: 'sink', label: 'Pia', query: 'sink', anchor: 'floor', footprint: [1, 1] },
      { id: 'dining-table', label: 'Mesa de jantar', query: 'table', anchor: 'floor', footprint: [3, 2] },
      { id: 'dining-chair', label: 'Cadeira', query: 'chair', anchor: 'floor', footprint: [1, 1] },
      { id: 'counter', label: 'Bancada', query: 'counter', anchor: 'floor', footprint: [2, 1] },
      { id: 'cabinet', label: 'Armário', query: 'cabinet', anchor: 'wall', footprint: [2, 1] },
      { id: 'microwave', label: 'Microondas', query: 'microwave', anchor: 'floor', footprint: [1, 1] },
      { id: 'mug', label: 'Caneca', query: 'mug', anchor: 'floor', footprint: [1, 1] },
    ],
  },
  {
    id: 'bedroom',
    label: 'Quarto',
    icon: '🛏',
    children: [
      { id: 'bed', label: 'Cama', query: 'bed', anchor: 'floor', footprint: [3, 2] },
      { id: 'nightstand', label: 'Criado-mudo', query: 'nightstand', anchor: 'floor', footprint: [1, 1] },
      { id: 'wardrobe', label: 'Guarda-roupa', query: 'wardrobe', anchor: 'floor', footprint: [2, 1] },
      { id: 'dresser', label: 'Cômoda', query: 'dresser', anchor: 'floor', footprint: [2, 1] },
      { id: 'desk-lamp', label: 'Abajur', query: 'lamp', anchor: 'floor', footprint: [1, 1] },
      { id: 'mirror', label: 'Espelho', query: 'mirror', anchor: 'wall', footprint: [1, 1] },
      { id: 'picture-frame', label: 'Quadro', query: 'painting', anchor: 'wall', footprint: [1, 1] },
    ],
  },
  {
    id: 'bathroom',
    label: 'Banheiro',
    icon: '🛁',
    children: [
      { id: 'toilet', label: 'Vaso sanitário', query: 'toilet', anchor: 'floor', footprint: [1, 1] },
      { id: 'sink-bath', label: 'Pia / lavatório', query: 'sink', anchor: 'floor', footprint: [1, 1] },
      { id: 'bathtub', label: 'Banheira', query: 'bathtub', anchor: 'floor', footprint: [3, 2] },
      { id: 'shower', label: 'Chuveiro / box', query: 'shower', anchor: 'floor', footprint: [2, 2] },
      { id: 'towel', label: 'Toalha', query: 'towel', anchor: 'wall', footprint: [1, 1] },
      { id: 'bath-mirror', label: 'Espelho', query: 'mirror', anchor: 'wall', footprint: [1, 1] },
    ],
  },
  {
    id: 'office',
    label: 'Escritório',
    icon: '💼',
    children: [
      { id: 'desk', label: 'Escrivaninha', query: 'desk', anchor: 'floor', footprint: [2, 1] },
      { id: 'office-chair', label: 'Cadeira de escritório', query: 'chair', anchor: 'floor', footprint: [1, 1] },
      { id: 'monitor', label: 'Monitor', query: 'monitor', anchor: 'floor', footprint: [1, 1] },
      { id: 'laptop', label: 'Laptop', query: 'laptop', anchor: 'floor', footprint: [1, 1] },
      { id: 'keyboard', label: 'Teclado', query: 'keyboard', anchor: 'floor', footprint: [1, 1] },
      { id: 'filing-cabinet', label: 'Arquivo', query: 'cabinet', anchor: 'floor', footprint: [1, 1] },
      { id: 'whiteboard', label: 'Quadro branco', query: 'whiteboard', anchor: 'wall', footprint: [2, 1] },
      { id: 'office-plant', label: 'Planta', query: 'plant', anchor: 'floor', footprint: [1, 1] },
    ],
  },
  {
    id: 'exterior',
    label: 'Exterior',
    icon: '🌳',
    children: [
      { id: 'tree', label: 'Árvore', query: 'tree', anchor: 'floor', footprint: [2, 2] },
      { id: 'rock', label: 'Pedra', query: 'rock', anchor: 'floor', footprint: [1, 1] },
      { id: 'bench', label: 'Banco de praça', query: 'bench', anchor: 'floor', footprint: [2, 1] },
      { id: 'fence', label: 'Cerca', query: 'fence', anchor: 'floor', footprint: [2, 1] },
      { id: 'streetlight', label: 'Poste', query: 'lamp', anchor: 'floor', footprint: [1, 1] },
      { id: 'car', label: 'Carro', query: 'car', anchor: 'floor', footprint: [2, 4] },
      { id: 'bicycle', label: 'Bicicleta', query: 'bicycle', anchor: 'floor', footprint: [1, 2] },
      { id: 'bush', label: 'Arbusto', query: 'bush', anchor: 'floor', footprint: [1, 1] },
    ],
  },
];

// indice flat de folhas por id pra lookups O(1)
const _leafIndex = (() => {
  const idx = {};
  for (const cat of tree) {
    for (const leaf of (cat.children || [])) {
      idx[leaf.id] = { ...leaf, categoryId: cat.id };
    }
  }
  return idx;
})();

export function getLeaf(id) { return _leafIndex[id] || null; }
export function getCategory(id) { return tree.find(c => c.id === id) || null; }
export function getTree() { return tree; }
export function allLeaves() { return Object.values(_leafIndex); }
