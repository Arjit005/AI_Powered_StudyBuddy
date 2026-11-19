import React from 'react';
import MarkdownRenderer from './MarkdownRenderer';

const StructuredMessage = ({ content, citations = [], onSelectCitation }) => {
    return (
        <MarkdownRenderer 
            content={content} 
            citations={citations} 
            onSelectCitation={onSelectCitation}
            className="max-w-[72ch]"
        />
    );
};

export default StructuredMessage;
