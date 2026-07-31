export const oceanManVideos = [
    'https://www.youtube.com/watch?v=tkzY_VwNIek',
    'https://www.youtube.com/watch?v=Aad3ufeWQDc',
    'https://www.youtube.com/watch?v=sX25DfAkmBo',
    'https://youtu.be/bC_k4ClAEqc',
    'https://youtu.be/ZjZFn4ZKIzY',
    'https://youtu.be/xfm8xjyBbeg',
    'https://youtu.be/qLTNjWdzqGo',
    'https://youtu.be/DU8Gq3-tccI',
    'https://youtu.be/NQLHwyY9S7w',
    'https://youtu.be/k2ECO76kI44',
    'https://youtu.be/RI5Z1Lo_oIk',
    'https://youtu.be/YCDLkW8uwz4',
    'https://youtu.be/W5jQm9esneU',
    'https://youtu.be/X0N9fQtzSHw',
    'https://youtu.be/BfSvnzWAm6Q',
    'https://youtu.be/CVi39Rl3GLI',
    'https://youtu.be/QFwq3CI1Jw0',
    'https://www.youtube.com/watch?v=8Oob96u2cOg',
    'https://www.youtube.com/watch?v=91nTBwkqG2k',
    'https://www.youtube.com/watch?v=A7LlJzEeI14',
    'https://www.youtube.com/watch?v=-W6abbyFQe0',
    'https://www.youtube.com/watch?v=49F1QWAl_u0',
    'https://www.youtube.com/watch?v=Mbu2KRC0wxg',
    'https://www.youtube.com/watch?v=I3lVZVWCdOo',
    'https://www.youtube.com/watch?v=vEyNlGXuqiw',
    'https://www.youtube.com/watch?v=BEc5hVMGcHw',
    'https://www.youtube.com/watch?v=ya-733fydeI',
] as const;

export function getRandomMan(): string {
    return oceanManVideos[Math.floor(Math.random() * oceanManVideos.length)]!;
}
