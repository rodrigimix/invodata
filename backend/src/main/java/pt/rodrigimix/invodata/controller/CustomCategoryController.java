package pt.rodrigimix.invodata.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pt.rodrigimix.invodata.dto.CreateCustomCategoryRequest;
import pt.rodrigimix.invodata.dto.CustomCategoryDTO;
import pt.rodrigimix.invodata.model.CustomCategory;
import pt.rodrigimix.invodata.service.category.CustomCategoryService;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/custom-categories")
@CrossOrigin("*")
public class CustomCategoryController {

    private final CustomCategoryService customCategoryService;

    @Autowired
    public CustomCategoryController(CustomCategoryService customCategoryService) {
        this.customCategoryService = customCategoryService;
    }

    @GetMapping
    public ResponseEntity<List<CustomCategoryDTO>> getUserCustomCategories(Principal principal) {
        List<CustomCategory> categories = customCategoryService.getUserCustomCategories(principal.getName());
        List<CustomCategoryDTO> dtos = categories.stream()
            .map(cat -> CustomCategoryDTO.builder()
                .id(cat.getId())
                .name(cat.getName())
                .color(cat.getColor())
                .build())
            .toList();
        return ResponseEntity.ok(dtos);
    }

    @PostMapping
    public ResponseEntity<CustomCategoryDTO> createCustomCategory(
            @RequestBody CreateCustomCategoryRequest request,
            Principal principal) {
        CustomCategory category = customCategoryService.createCustomCategory(
            principal.getName(),
            request.getName(),
            request.getColor());

        CustomCategoryDTO dto = CustomCategoryDTO.builder()
            .id(category.getId())
            .name(category.getName())
            .color(category.getColor())
            .build();

        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCustomCategory(
            @PathVariable Long id,
            Principal principal) {
        customCategoryService.deleteCustomCategory(id, principal.getName());
        return ResponseEntity.noContent().build();
    }
}

