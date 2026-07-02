package pt.rodrigimix.invodata.service.invoice.category;

import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import pt.rodrigimix.invodata.dto.InvoiceCategoryRequest;
import pt.rodrigimix.invodata.dto.InvoiceCategoryResponse;
import pt.rodrigimix.invodata.model.InvoiceCategory;
import pt.rodrigimix.invodata.repository.InvoiceCategoryRepository;

import java.text.Normalizer;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
public class InvoiceCategoryService {
    private static final Pattern NON_ALNUM = Pattern.compile("[^A-Z0-9]+");
    private static final Pattern HEX_COLOR = Pattern.compile("^#[0-9A-F]{6}$");
    private static final String DEFAULT_COLOR = "#64748B";

    private final InvoiceCategoryRepository repository;

    public InvoiceCategoryService(InvoiceCategoryRepository repository) {
        this.repository = repository;
    }

    public List<InvoiceCategoryResponse> listCategories() {
        return repository.findAllByOrderByNameAsc().stream()
            .map(category -> new InvoiceCategoryResponse(
                category.getId(),
                category.getName(),
                category.getColor()))
                .toList();
    }

    public List<String> listCategoryNames() {
        return repository.findAllByOrderByNameAsc().stream()
                .map(InvoiceCategory::getName)
                .toList();
    }

    public InvoiceCategoryResponse createCategory(InvoiceCategoryRequest request) {
        String normalized = normalizeName(request != null ? request.name() : null);
        if (normalized == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category name is required.");
        }
        if (repository.existsByNameIgnoreCase(normalized)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Category already exists.");
        }
        String color = normalizeColor(request != null ? request.color() : null);
        InvoiceCategory category = InvoiceCategory.builder()
                .name(normalized)
                .color(color)
                .build();
        InvoiceCategory saved = repository.save(category);
        return new InvoiceCategoryResponse(saved.getId(), saved.getName(), saved.getColor());
    }

    public InvoiceCategoryResponse updateCategory(Long id, InvoiceCategoryRequest request) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category id is required.");
        }
        InvoiceCategory category = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found."));
        String normalized = normalizeName(request != null ? request.name() : null);
        if (normalized == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category name is required.");
        }
        Optional<InvoiceCategory> existing = repository.findByNameIgnoreCase(normalized);
        if (existing.isPresent() && !existing.get().getId().equals(category.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Category already exists.");
        }
        String color = normalizeColor(request != null ? request.color() : null);
        category.setName(normalized);
        category.setColor(color);
        InvoiceCategory saved = repository.save(category);
        return new InvoiceCategoryResponse(saved.getId(), saved.getName(), saved.getColor());
    }

    public void deleteCategory(Long id) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category id is required.");
        }
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found.");
        }
        repository.deleteById(id);
    }

    private String normalizeName(String raw) {
        if (raw == null) {
            return null;
        }
        String value = raw.trim();
        if (value.isEmpty()) {
            return null;
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String upper = normalized.toUpperCase();
        String cleaned = NON_ALNUM.matcher(upper).replaceAll("_");
        cleaned = cleaned.replaceAll("^_+|_+$", "");
        cleaned = cleaned.replaceAll("_+", "_");
        return cleaned.isBlank() ? null : cleaned;
    }

    private String normalizeColor(String raw) {
        if (raw == null || raw.isBlank()) {
            return DEFAULT_COLOR;
        }
        String upper = raw.trim().toUpperCase();
        if (HEX_COLOR.matcher(upper).matches()) {
            return upper;
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid color format.");
    }
}
