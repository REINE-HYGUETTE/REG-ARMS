package com.reg.arms.entity.enums;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class RequestStatusConverter implements AttributeConverter<RequestStatus, String> {

    @Override
    public String convertToDatabaseColumn(RequestStatus status) {
        return status == null ? null : status.toDbValue();
    }

    @Override
    public RequestStatus convertToEntityAttribute(String dbValue) {
        return dbValue == null ? null : RequestStatus.fromDbValue(dbValue);
    }
}
