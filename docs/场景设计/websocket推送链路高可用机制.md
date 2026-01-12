## 1. 概述

本服务基于 Spring Boot，整合了 RabbitMQ、Redis 和 WebSocket，提供了 WebSocket 的实时推送和离线补偿功能。核心设计思路如下：

1. **接收**：WebSocket 服务接收来自上游通过 MQ 传递的消息，待发送至前端。
    
2. **消费**：WebSocket 服务消费 MQ 中的消息，进行去重（避免重复推送相同信息），并判断用户的在线状态。
    
3. **推送**：对于在线用户，通过 Redis 发布/订阅机制将消息推送至 WebSocket；对于离线用户，将消息缓存至 Redis，待用户重连后进行补偿推送。
    
4. **心跳机制**：前端定期发送心跳消息，保持会话续期，确保在线状态的准确性。
    
5. **扩展性**：支持多实例部署，通过 `nodeId` 定向推送，**避免跨实例冗余推送**。
    

## 2. 系统流程

### 2.1 WebSocket 连接与离线补偿

**流程说明**：用户在前端建立 WebSocket 连接时，后端需要记录用户所在WebSocket服务的节点并为其准备离线期间的待推消息。

1. 客户端通过 `ws://host:port/ws?userId={userId}` 发起连接。
    
2. 服务端 `afterConnectionEstablished` 回调：
    
    - 将 `user:session:{userId}` 写入 Redis，并设置 TTL（如 300 秒），用于判断用户在线状态。
        
        > `user:session:{userId}` 的值包含 `sessionId` 和 `nodeId`。在多节点 WebSocket 服务部署场景下，后端可以通过 `userId` 确定与该用户建立连接的 WebSocket 节点，从而处理后续消息。
        > 
        > 此外，后端通过 WebSocket 向用户推送消息时，会首先检查 Redis 中是否存在该键。如果不存在，说明用户的心跳已停止，推送会跳过，消息会被缓存至 Redis，待用户重连时进行补偿。
        
    - 查询 `charging:pending:{userId}`：如果存在离线期间的状态更新，则立即推送给前端，并删除该缓存，确保消息不重复。
        

private static final Map<String, WebSocketSession> sessionMap = new ConcurrentHashMap<>();  
​  
@Override  
public void afterConnectionEstablished(WebSocketSession session) throws Exception {  
    String userId = extractUserId(session);  
    sessionMap.put(userId, session);  
    // 保存映射  
    redisTemplate.opsForValue()  
        .set("user:session:" + userId,  
             JSON.toJSONString(Map.of("sessionId", session.getId(), "nodeId", nodeId)),  
             300, TimeUnit.SECONDS);  
      
    // 新建连立即写入最后心跳时间  
        session.getAttributes().put("lastBeat", System.currentTimeMillis()); // 这个用于超时会话的踢出  
      
    // 补偿离线消息  
    String pending = redisTemplate.opsForValue().get("charging:pending:" + userId);  
    if (pending != null) {  
        session.sendMessage(new TextMessage(pending));  
        redisTemplate.delete("charging:pending:" + userId);  
    }  
}

### 2.2 RabbitMQ 消息消费与分流

1. 上游通过MQ把要发送的信息传递到WebSocket服务的MQ监听者
    
2. `@RabbitListener` 从 队列接收消息。
    
3. **去重**：上游生产者把完整状态传递到下游，只有状态发生变化才会继续往下走
    
4. **在线分流**：
    
    - Redis 中存在 `user:session:{userId}` → 调用 `RedisPublishService.sendToNode(nodeId, msg)`。
        
        > Redis 中存在 `user:session:{userId}`说明WebSocket的心跳在跳
        
    - 否则 → 将消息存入 `charging:pending:{userId}`，TTL 1 小时。
        

@RabbitListener(queues = "charging.status.queue")  
public void onMessage(String msg) {  
    ChargingStatus status = JSON.parseObject(msg, ChargingStatus.class);  
    if (!msg.equals(snapshot.getState(status.getDeviceId()))) {  
        snapshot.saveState(status.getDeviceId(), msg);  
        String info = redisTemplate.opsForValue().get("user:session:" + status.getUserId());  
        if (info != null) {  
            String node = JSON.parseObject(info).getString("nodeId");  
            redisPublishService.sendToNode(node, msg);  
        } else {  
            redisTemplate.opsForValue()  
                .set("charging:pending:" + status.getUserId(), msg, 1, TimeUnit.HOURS);  
        }  
    }  
}

### 2.3 Redis 发布/订阅推送

- **流程说明**：通过 Redis 的发布/订阅机制，将消息从 Redis 路由到指定的 WebSocket 实例，由该实例的 WebSocket handler 推送给客户端。
    
    - **订阅处理**：每个实例通过 `RedisChargingStatusSubscriber` 订阅自己的频道，接收到消息后解析 `userId`，并调用 `ChargingWebSocketHandler.sendMessage` 将消息推送给前端。
        
    - **定向发布**：在 `sendToNode` 方法中，向 `ws-node-{nodeId}` 频道发布消息，确保只有对应实例会收到该消息。
        

// 发布服务 RedisPublishService.java  
public void sendToNode(String nodeId, String msg) {  
    redisTemplate.convertAndSend("ws-node-" + nodeId, msg);  
}  
​  
// 订阅者 RedisChargingStatusSubscriber.java  
@Override  
public void onMessage(Message message, byte[] pattern) {  
    String json = message.toString();  
    ChargingStatus status = JSON.parseObject(json, ChargingStatus.class);  
    ChargingWebSocketHandler.sendMessage(status.getUserId(), json);  
}  
​  
// ChargingWebSocketHandler.java  
    // 本地推送（供 RedisSubscriber 调用）  
    public static void sendMessage(String userId, String message) {  
        WebSocketSession session = sessionMap.get(userId);  
        if (session != null && session.isOpen()) {  
            try {  
                session.sendMessage(new TextMessage(message));  
            } catch (Exception e) {  
                log.error("Send to user={} failed", userId, e);  
            }  
        }  
    }

### 2.4 心跳续期

**流程说明**：前端通过定时发送心跳消息，让后端知道连接仍然活跃，并续期 Redis 中的会话映射，以避免过早被判定为离线。

- 前端定期（例如每 2 分钟）发送：`{ "type":"heartbeat" }`。
    
- 服务端在 `handleTextMessage` 方法中检测到心跳后，不作业务转发，而是调用 Redis 的 `expire` 方法刷新 `user:session:{userId}` 的 TTL（例如 300 秒）。
    
- 如若长时间未收到心跳，Redis 键过期，将被视为离线，后续消息会进入离线缓存逻辑。
    

    private static final Map<String, WebSocketSession> sessionMap = new ConcurrentHashMap<>();  
    @Override  
    public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {  
        String payload = message.getPayload();  
​  
        // —— 应用层心跳 ——  
        // 前端定期发 {"type":"heartbeat"}  
        if (payload.contains("\"type\":\"heartbeat\"")) {  
            String userId = extractUserId(session);  
            // **★ 更新最后心跳时间**  
            session.getAttributes().put("lastBeat", System.currentTimeMillis());  
            // 刷新 Redis 中这条会话映射的过期时间  
            redisTemplate.expire(  
                    "user:session:" + userId,  
                    SESSION_TTL_SECONDS,  
                    TimeUnit.SECONDS  
            );  
            log.debug("Heartbeat received from {}, TTL extended", userId);  
            return;  // 心跳不往下传递  
        }  
​  
        // —— 其它消息继续走原有逻辑 ——  
        super.handleTextMessage(session, message);  
    }

### 2.5 空闲节点回收

对于心跳断了的WebSocket连接，除了要做离线补偿，还应该把离线会话清除。

在WebSocket连接建立的时候，就在session的attributes中写入了最后心跳时间，并且，在心跳续期的时候，同样在session的attributes中写入了最后心跳时间。那么，需要创建一个定时任务，扫描 sessionMap中最后心跳时间大于MAX_IDLE_MILLIS （允许的最大静默时长）中的session，并调用close关闭连接（默认的MAX_IDLE_MILLIS 为发心跳间隔 * 2）

@Component  
public class WsIdleKicker {  
​  
    @Autowired  
    private StringRedisTemplate redisTemplate;  
​  
    /** 与 Handler 里的 map 共享同一个实例 */  
    private final Map<String, WebSocketSession> sessionMap =  
            ChargingWebSocketHandler.getSessionMap();   // 给 Handler 加个 public static getter  
​  
    @Scheduled(fixedDelay = 30_000)   // 每 30 s 扫描一次  
    public void kickIdleSessions() {  
        long now = System.currentTimeMillis();  
​  
        // 用迭代器可边遍历边安全删除  
        Iterator<Map.Entry<String, WebSocketSession>> it = sessionMap.entrySet().iterator();  
        while (it.hasNext()) {  
            Map.Entry<String, WebSocketSession> e = it.next();  
            WebSocketSession session = e.getValue();  
​  
            Long lastBeat = (Long) session.getAttributes().get("lastBeat");  
            if (lastBeat == null || now - lastBeat > ChargingWebSocketHandler.MAX_IDLE_MILLIS) {  
                try {  
                    session.close(CloseStatus.GOING_AWAY);   // 1001，客户端会触发 onClose  
                } catch (IOException ignored) { }  
                it.remove();                                // 从本地 map 清掉  
                redisTemplate.delete("user:session:" + e.getKey()); // 立即让业务端识别为离线  
            }  
        }  
    }  
}

### 2.6 水平扩展

- 每个WebSocket服务实例在配置中设置不同 `ws.server.id` 作为 `nodeId`。
    
- 仅订阅 `ws-node-{nodeId}` 频道，消息定向到目标实例。
    
- 全局广播（如全员通知）使用统一 `websocket` 频道。
    

## 3. 其他问题

**为什么要在 Redis 中** `user:session:{userId}` **这个键的值除了存储** `sessionId` **之外还要存储** `nodeId`**？**

在WebSocket多节点部署的场景下，任一WebSocket节点消费 RabbitMQ 消息后，需要将信息推送给特定用户对应的 WebSocket 实例（不能随机推送一个，因为WebSocket是有状态的，每个WebSocket服务都维护与若干用户的长连接）。

那么如何推送呢？有两种方法：广播与定向推送

若采用广播方式，每个节点都会接收到消息并在本地会话映射中查找 `sessionId`，如果找得到，那么说明这个sessionId属于这个节点，然后可以做后续处理，如果找不到，那么说明这个sessionId不是由这个结点维护的。这种方法实现简单，但是不仅浪费网络带宽和 CPU，还可能引入跨实例查找延迟。

如果采用定向推送的方式，我们可以在 Redis 的 `user:session:{userId}` 中同时保存 `sessionId` 和 `nodeId`：

- **sessionId**：用于定位具体的 WebSocket 会话。
    
- **nodeId**：用于确定消息要路由到哪台实例。
    

下游消费者只需读取 `nodeId`，通过定向发布减少广播开销：

// 从 Redis 获取存储的信息  
String info = redisTemplate.opsForValue().get("user:session:" + userId);  
String node = JSON.parseObject(info).getString("nodeId");  
// 定向发布到目标节点的 Redis 频道  
redisPublishService.sendToNode(node, messageJson);

这样，只有对应 `nodeId` 的实例会收到消息并推送给前端，避免了跨实例的无效广播。

**sendToNode 方法实现与原理**

`sendToNode` 方法内部调用了 `StringRedisTemplate.convertAndSend(channel, message)`，等同于执行 Redis 的 `PUBLISH` 命令，将消息发送到指定频道。每个 WebSocket 服务实例在启动时，都会通过 `RedisMessageListenerContainer` 订阅自己对应的 `ws-node-{nodeId}` 频道：

redisTemplate.convertAndSend("ws-node-" + nodeId, messageJson);

订阅者接收到消息后，会回调 `onMessage`，并将消息推送给本地的 WebSocket 会话。只有订阅了该频道的实例会收到并处理这条消息。