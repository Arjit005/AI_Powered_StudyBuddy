
import os
import io
import base64
from sqlalchemy.orm import Session
from . import models

# Ensure headless matplotlib directory
os.environ.setdefault('MPLCONFIGDIR', '/tmp/matplotlib')

def generate_study_chart(db: Session):
    # 1. Fetch data using SQLALchemy
    query = db.query(models.StudySession.activity_type, models.StudySession.duration_seconds)
    data = query.all()

    if not data:
        return None

    # Lazy-import pandas and matplotlib only when chart generation is requested
    import pandas as pd
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    # 2. Convert to Pandas DataFrame
    df = pd.DataFrame(data, columns=['Activity', 'Seconds'])

    # 3. Clean and Aggregate Data
    # Convert seconds to minutes for better readability
    df['Minutes'] = df['Seconds'] / 60
    
    # Group by Activity Type
    summary = df.groupby('Activity')['Minutes'].sum().reset_index()

    # 4. detailed Matplotlib Visualization (thread-safe isolated figure & axes)
    fig, ax = plt.subplots(figsize=(10, 6))
    try:
        # Custom styling - scalable cyclic colormap prevents ValueError if > 3 activities
        base_palette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899']
        bar_colors = [base_palette[i % len(base_palette)] for i in range(len(summary))]
        bars = ax.bar(summary['Activity'], summary['Minutes'], color=bar_colors)
        
        # Add labels and title
        ax.set_title('Study Time Distribution', fontsize=16, fontweight='bold', pad=20)
        ax.set_xlabel('Activity Type', fontsize=12)
        ax.set_ylabel('Total Minutes', fontsize=12)
        
        # Add value labels on top of bars
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                    f'{height:.1f}m',
                    ha='center', va='bottom')

        # Remove top and right spines for cleaner look
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        
        # Add grid on y-axis
        ax.grid(axis='y', linestyle='--', alpha=0.7)

        # 5. Save to Bytes Buffer
        buffer = io.BytesIO()
        fig.savefig(buffer, format='png', bbox_inches='tight', dpi=100)
        buffer.seek(0)
    finally:
        plt.close(fig)

    # 6. Encode to Base64
    image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return image_base64
