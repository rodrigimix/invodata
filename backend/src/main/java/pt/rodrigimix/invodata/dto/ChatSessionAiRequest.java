package pt.rodrigimix.invodata.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record ChatSessionAiRequest(
        String sessionId,
        UserRef user,
        List<Message> messages,
        String summary,
        @JsonProperty("finance_snapshot") FinanceSnapshot financeSnapshot) {
    public record UserRef(String id, String username, String language) {
    }

    public record Message(String role, String content) {
    }
}
