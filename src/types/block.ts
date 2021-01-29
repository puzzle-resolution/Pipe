

export type InitBlock = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export const enum BlockTypeEnum {
    Sharp1 = "Sharp1", //定义为 1个度的节点形状
    Sharp2 = "Sharp2", //定义为 2个度，无转折的节点形状
    Sharp3 = "Sharp3", //定义为 2个度，有转折的节点形状
    Sharp4 = "Sharp4", //定义为 3个度的节点形状
}



export interface Position {
    x: number,
    y: number,
}