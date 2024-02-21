import os
import mlflow
from pathlib import Path
import argparse
import shutil
import pandas as pd


MLFLOW_URL = 'https://trn001-konstellation-mlflow.kdl-dell.konstellation.io'
os.environ['MLFLOW_S3_ENDPOINT_URL'] = 'https://minio.kdl-dell.konstellation.io'

mlflow.set_tracking_uri(MLFLOW_URL)

def experiment_exists(name):
    return name in mlflow.list_experiments()

def download_frames(parent_id, experiment_name, model_destination):
    model_destination = Path('models') / model_destination 
    print(f"Downloading frames to {model_destination}")
    model_destination.mkdir(exist_ok=True)
    starting_frame = 0
    for file in model_destination.iterdir():
        if file.stem.startswith('frame'):
            frame = int(file.stem.split('_')[-1])
            if frame > starting_frame:
                starting_frame = frame

    print(f"Starting from frame {starting_frame}")

    child_runs = mlflow.search_runs(experiment_names=[experiment_name],
                                    filter_string=f"tags.mlflow.parentRunId = '{parent_id}'")
    parent_run =  mlflow.search_runs(experiment_names=[experiment_name],
                                    filter_string=f"tags.mlflow.RunId = '{parent_id}'")
    print(parent_run)
    assert len(child_runs) > 0, f"No child runs found for parent run {parent_id}"
    child_runs = child_runs.sort_values(by=['tags.mlflow.runName'])
    child_runs = child_runs.iloc[starting_frame:]
    child_runs = pd.concat([child_runs, parent_run], ignore_index=True)
    print(child_runs)
    for _, run in child_runs.iterrows():
        print(run)
        run_id = run['run_id']
        frame_name = int(run['tags.mlflow.runName'].split('_')[-1])
        try:
            temp_dir = mlflow.artifacts.download_artifacts(run_id=run_id, artifact_path='point_cloud', dst_path='temp_dir')
        except Exception as e:
            print(f"Failed to download run {run_id}")
            print(e)
            continue
        iteration = [int(iteration_folder.stem.split('_')[-1]) for iteration_folder in Path(temp_dir).iterdir()]
        max_iteration = max(iteration)
        print(f"Downloaded run {run_id} with {max_iteration} iterations")
        (Path(temp_dir) / f'iteration_{max_iteration}' / 'point_cloud.ply').rename( model_destination / f'frame_{frame_name}.ply')
    shutil.rmtree('temp_dir')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Download experiments from MLFlow')
    parser.add_argument('--experiment_name', type=str, help='Experiment id')
    parser.add_argument('--parent_id', type=str, help='Parent run id')
    parser.add_argument('--model_destination', type=str, help='Destination folder for the models', default='new_model')
    args = parser.parse_args()
    parent_id = args.parent_id
    experiment_name = args.experiment_name
    model_destination = args.model_destination

    download_frames(parent_id, experiment_name, model_destination)