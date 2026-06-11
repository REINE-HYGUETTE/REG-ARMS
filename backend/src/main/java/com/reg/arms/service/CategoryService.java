package com.reg.arms.service;

import com.reg.arms.dto.request.CreateCategoryRequest;
import com.reg.arms.dto.response.CategoryResponse;
import com.reg.arms.entity.Category;
import com.reg.arms.exception.BadRequestException;
import com.reg.arms.exception.ResourceNotFoundException;
import com.reg.arms.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;

    @Transactional(readOnly = true)
    public List<CategoryResponse> listAll() {
        return categoryRepository.findByIsActiveTrueOrderByNameAsc().stream()
                .map(CategoryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> listAllForAdmin() {
        return categoryRepository.findAllByOrderByNameAsc().stream()
                .map(CategoryResponse::from)
                .toList();
    }

    @Transactional
    public CategoryResponse create(CreateCategoryRequest dto) {
        if (categoryRepository.existsByNameIgnoreCaseAndIsActiveTrue(dto.getName())) {
            throw new BadRequestException("A category with this name already exists");
        }
        Category category = Category.builder()
                .name(dto.getName())
                .description(dto.getDescription())
                .defaultPriority(dto.getDefaultPriority())
                .isActive(true)
                .build();
        return CategoryResponse.from(categoryRepository.save(category));
    }

    @Transactional
    public CategoryResponse update(Long id, CreateCategoryRequest dto) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));
        if (!category.getName().equalsIgnoreCase(dto.getName()) &&
                categoryRepository.existsByNameIgnoreCaseAndIsActiveTrue(dto.getName())) {
            throw new BadRequestException("A category with this name already exists");
        }
        category.setName(dto.getName());
        category.setDescription(dto.getDescription());
        category.setDefaultPriority(dto.getDefaultPriority());
        return CategoryResponse.from(categoryRepository.save(category));
    }

    @Transactional
    public void delete(Long id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));
        category.setIsActive(false);
        categoryRepository.save(category);
    }

    @Transactional
    public void activate(Long id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", id));
        category.setIsActive(true);
        categoryRepository.save(category);
    }
}
