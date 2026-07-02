package pt.rodrigimix.invodata.service.category;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import pt.rodrigimix.invodata.model.CustomCategory;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.repository.CustomCategoryRepository;
import pt.rodrigimix.invodata.service.user.UserService;

import java.util.List;

@Service
public class CustomCategoryService {

    private final Logger logger = LoggerFactory.getLogger(CustomCategoryService.class);
    private final CustomCategoryRepository customCategoryRepository;
    private final UserService userService;

    @Autowired
    public CustomCategoryService(CustomCategoryRepository customCategoryRepository,
                                UserService userService) {
        this.customCategoryRepository = customCategoryRepository;
        this.userService = userService;
    }

    public List<CustomCategory> getUserCustomCategories(String username) {
        logger.debug("Fetching custom categories for user: {}", username);
        return customCategoryRepository.findByUserUsernameIgnoreCaseOrderByNameAsc(username);
    }

    public CustomCategory createCustomCategory(String username, String categoryName, String color) {
        User user = userService.getUserFromUsername(username);

        if (categoryName == null || categoryName.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category name cannot be empty");
        }

        String trimmedName = categoryName.trim();

        // Check if category already exists for this user
        if (customCategoryRepository.findByUserIdAndNameIgnoreCase(user.getId(), trimmedName).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Category already exists");
        }

        String validColor = (color != null && !color.trim().isEmpty()) ? color.trim() : "#3B82F6";

        CustomCategory customCategory = CustomCategory.builder()
            .user(user)
            .name(trimmedName)
            .color(validColor)
            .build();

        CustomCategory saved = customCategoryRepository.save(customCategory);
        logger.info("Custom category created: {} with color: {} for user: {}", trimmedName, validColor, username);
        return saved;
    }

    public void deleteCustomCategory(Long categoryId, String username) {
        User user = userService.getUserFromUsername(username);

        CustomCategory category = customCategoryRepository.findByIdAndUserId(categoryId, user.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Custom category not found"));

        customCategoryRepository.delete(category);
        logger.info("Custom category deleted: {} for user: {}", category.getName(), username);
    }
}

