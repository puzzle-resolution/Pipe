
function parseTask(key: string, puzzleWidth: number, puzzleHeight: number) {
    let task: any[][] = [];
    for (var t = 0; t < puzzleHeight; t++) {
        task[t] = [];
        for (var e = 0; e < puzzleWidth; e++) {
            var i = t * puzzleWidth + e;
            task[t][e] = parseInt(key[i], 16)
        }
    }
    return task;
}
export default parseTask;

/**
 * task[i] 代表一列
 * task[i][j] 代表一列数据
 *
 * 定义1个度的节点为 形状1
 * 定义2个度，无转折的节点为 形状2
 * 定义2个度，有转折的节点为 形状3
 * 定义3个度的节点为 形状4
 *
 * task[i][j] 值范围为 0-15
 * 实际上不存在 0 和 15，因为不存在度为0或4的节点
 *
 * 定义 值的二进制表示 0b(a)(b)(c)(d)
 *
 * a位代表 开口方向为 下
 * b位代表 开口方向为 左
 * c位代表 开口方向为 上
 * d位代表 开口方向为 右
 *
 */