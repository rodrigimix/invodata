package pt.rodrigimix.invodata.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pt.rodrigimix.invodata.dto.InvoiceCategoryRequest;
import pt.rodrigimix.invodata.dto.InvoiceCategoryResponse;
import pt.rodrigimix.invodata.service.invoice.category.InvoiceCategoryService;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
@CrossOrigin("*")
public class InvoiceCategoryController {

    private final InvoiceCategoryService categoryService;

    public InvoiceCategoryController(InvoiceCategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    public ResponseEntity<List<InvoiceCategoryResponse>> listCategories() {
        return ResponseEntity.ok(categoryService.listCategories());
    }

    @PostMapping
    public ResponseEntity<InvoiceCategoryResponse> createCategory(@RequestBody InvoiceCategoryRequest request) {
        return ResponseEntity.ok(categoryService.createCategory(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<InvoiceCategoryResponse> updateCategory(@PathVariable Long id,
            @RequestBody InvoiceCategoryRequest request) {
        return ResponseEntity.ok(categoryService.updateCategory(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        categoryService.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }
}
