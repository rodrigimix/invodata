package pt.rodrigimix.invodata.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pt.rodrigimix.invodata.dto.ChatRequest;
import pt.rodrigimix.invodata.dto.ChatResponse;
import pt.rodrigimix.invodata.dto.ChatMessageResponse;
import pt.rodrigimix.invodata.dto.ChatSessionListItem;
import pt.rodrigimix.invodata.dto.ChatSessionResponse;
import pt.rodrigimix.invodata.dto.ChatSessionUpdateRequest;
import pt.rodrigimix.invodata.service.chat.ChatSessionService;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/chat")
@CrossOrigin("*")
public class ChatController {

    private final ChatSessionService chatSessionService;

    public ChatController(ChatSessionService chatSessionService) {
        this.chatSessionService = chatSessionService;
    }

    @PostMapping("/sessions")
    public ResponseEntity<ChatSessionResponse> createSession(Principal principal,
            @RequestParam(required = false) String title) {
        return ResponseEntity.ok(chatSessionService.createSession(principal.getName(), title));
    }

    @PostMapping("/sessions/{sessionId}/messages")
    public ResponseEntity<ChatResponse> postMessage(@PathVariable String sessionId,
            @RequestBody ChatRequest request,
            Principal principal) {
        return ResponseEntity.ok(chatSessionService.postMessage(sessionId, principal.getName(), request.message()));
    }

    @GetMapping("/sessions/{sessionId}/messages")
    public ResponseEntity<List<ChatMessageResponse>> getMessages(@PathVariable String sessionId,
            @RequestParam(defaultValue = "20") int limit,
            Principal principal) {
        return ResponseEntity.ok(chatSessionService.getMessages(sessionId, principal.getName(), limit));
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<ChatSessionListItem>> getSessions(@RequestParam(defaultValue = "30") int limit,
            Principal principal) {
        return ResponseEntity.ok(chatSessionService.getSessions(principal.getName(), limit));
    }

    @PutMapping("/sessions/{sessionId}")
    public ResponseEntity<ChatSessionListItem> updateSession(@PathVariable String sessionId,
            @Valid @RequestBody ChatSessionUpdateRequest request,
            Principal principal) {
        return ResponseEntity
                .ok(chatSessionService.updateSessionTitle(sessionId, principal.getName(), request.title()));
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Void> deleteSession(@PathVariable String sessionId,
            Principal principal) {
        chatSessionService.deleteSession(sessionId, principal.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/sessions/{sessionId}/summary")
    public ResponseEntity<Map<String, String>> getSummary(@PathVariable String sessionId,
            Principal principal) {
        return chatSessionService.getLatestSummary(sessionId, principal.getName())
                .map(summary -> ResponseEntity.ok(Map.of("summary", summary)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
