# TCP 拥塞控制窗口计算

- 题型：综合题
- 知识点：运输层、TCP 拥塞控制、慢开始、拥塞避免、快重传与快恢复
- 来源：自拟练习题（非真题）

## 题目

某 TCP 连接的拥塞窗口 cwnd 初始为 1 MSS，慢开始门限 ssthresh 初始为 16 MSS。传输过程中没有发生超时，但在第 8 个 RTT 结束时检测到 3 个重复 ACK。

（1）第 8 个 RTT 结束时 cwnd 是多少？

（2）收到 3 个重复 ACK 后，ssthresh 和 cwnd 如何调整？

（3）之后采用什么算法，cwnd 如何增长？

## 答案

（1）20 MSS。

（2）ssthresh 调整为 10 MSS，cwnd 调整为 13 MSS。

（3）进入快恢复阶段：每收到一个重复 ACK，cwnd 加 1 MSS；收到新的 ACK 后，cwnd 降为 10 MSS，进入拥塞避免阶段，每经过一个 RTT，cwnd 加 1 MSS。

## 解析

慢开始阶段 cwnd 每经过一个 RTT 翻倍：

- 第 1 个 RTT 结束：2 MSS
- 第 2 个 RTT 结束：4 MSS
- 第 3 个 RTT 结束：8 MSS
- 第 4 个 RTT 结束：16 MSS，达到 ssthresh

之后进入拥塞避免，每个 RTT 加 1 MSS：

- 第 5 个 RTT 结束：17 MSS
- 第 6 个 RTT 结束：18 MSS
- 第 7 个 RTT 结束：19 MSS
- 第 8 个 RTT 结束：20 MSS

收到 3 个重复 ACK 时执行快重传和快恢复：

- ssthresh = max(cwnd ÷ 2, 2) = 10 MSS
- cwnd = ssthresh + 3 = 13 MSS

常见错误：把慢开始的起点算成第 1 个 RTT 结束才为 1 MSS；把 3 个重复 ACK 当成超时处理。
