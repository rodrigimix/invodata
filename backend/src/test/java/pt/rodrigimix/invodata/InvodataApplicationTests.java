package pt.rodrigimix.invodata;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.boot.test.mock.mockito.MockBean;
import pt.rodrigimix.invodata.service.chat.ChatSessionService;
import pt.rodrigimix.invodata.repository.ChatRepository;
import pt.rodrigimix.invodata.repository.ChatSessionRepository;
import pt.rodrigimix.invodata.repository.ChatSummaryRepository;

@SpringBootTest
@ActiveProfiles("test")
class InvodataApplicationTests {

	@MockBean
	private ChatSessionService chatSessionService;

	@MockBean
	private ChatRepository chatRepository;

	@MockBean
	private ChatSessionRepository chatSessionRepository;

	@MockBean
	private ChatSummaryRepository chatSummaryRepository;

	@Test
	void contextLoads() {
	}

}
