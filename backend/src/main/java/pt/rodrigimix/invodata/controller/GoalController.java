package pt.rodrigimix.invodata.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pt.rodrigimix.invodata.dto.GoalUpdateRequest;
import pt.rodrigimix.invodata.model.Goal;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.service.goal.GoalService;
import pt.rodrigimix.invodata.service.user.UserService;

import java.math.BigDecimal;
import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/goals")
@CrossOrigin("*")
public class GoalController {

    private GoalService goalService;

    private UserService userService;

    public GoalController(GoalService goalService, UserService userService) {
        this.goalService = goalService;
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<List<Goal>> getAll(Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        return ResponseEntity.ok(goalService.getGoals(user));
    }

    @PostMapping
    public ResponseEntity<Goal> create(@RequestBody Goal goal, Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        return ResponseEntity.ok(goalService.createGoal(goal, user));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        goalService.deleteGoal(id, user);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}")
    public ResponseEntity<Goal> update(@PathVariable Long id,
                                       @RequestBody GoalUpdateRequest request,
                                       Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        return ResponseEntity.ok(goalService.updateGoal(id, request, user));
    }

    @PatchMapping("/{id}/add-funds")
    public ResponseEntity<Goal> addFunds(
            @PathVariable Long id,
            @RequestBody Map<String, BigDecimal> payload,
            Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        return ResponseEntity.ok(goalService.addFunds(id, payload.get("amount"), user));
    }
}
