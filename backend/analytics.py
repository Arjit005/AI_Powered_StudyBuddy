
import pandas as pd
import matplotlib.pyplot as plt
import io
import base64
from sqlalchemy.orm import Session
from . import models

def generate_study_chart(db: Session):
    # 1. Fetch data using SQLALchemy
    query = db.query(models.StudySession.activity_type, models.StudySession.duration_seconds)
    data = query.all()

    if not data:
        return None

    # 2. Convert to Pandas DataFrame
    df = pd.DataFrame(data, columns=['Activity', 'Seconds'])

    # 3. Clean and Aggregate Data
    # Convert seconds to minutes for better readability
    df['Minutes'] = df['Seconds'] / 60
    
    # Group by Activity Type
    summary = df.groupby('Activity')['Minutes'].sum().reset_index()

    # 4. detailed Matplotlib Visualization
    plt.figure(figsize=(10, 6))
    
    # Custom styling
    bars = plt.bar(summary['Activity'], summary['Minutes'], color=['#3b82f6', '#10b981', '#f59e0b'])
    
    # Add labels and title
    plt.title('Study Time Distribution', fontsize=16, fontweight='bold', pad=20)
    plt.xlabel('Activity Type', fontsize=12)
    plt.ylabel('Total Minutes', fontsize=12)
    
    # Add value labels on top of bars
    for bar in bars:
        height = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2., height,
                f'{height:.1f}m',
                ha='center', va='bottom')

    # Remove top and right spines for cleaner look
    plt.gca().spines['top'].set_visible(False)
    plt.gca().spines['right'].set_visible(False)
    
    # Add grid on y-axis
    plt.grid(axis='y', linestyle='--', alpha=0.7)

    # 5. Save to Bytes Buffer
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', bbox_inches='tight', dpi=100)
    buffer.seek(0)
    plt.close()

    # 6. Encode to Base64
    image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return image_base64
